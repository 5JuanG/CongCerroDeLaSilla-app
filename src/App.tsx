import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AsistenciaForm from './components/AsistenciaForm';
import AsistenciaReporte from './components/AsistenciaReporte';
import Publicadores from './components/Publicadores';
import RegistrosServicio from './components/RegistrosServicio';
import Grupos from './components/Grupos';
import InformeServicio from './components/InformeServicio';
import Territorios from './components/Territorios';
import PrecursorAuxiliar from './components/PrecursorAuxiliar';
import ControlAcceso from './components/ControlAcceso';
import SeguimientoInformes from './components/SeguimientoInformes';
import { InformeMensualGrupo } from './components/InformeMensualGrupo';
import GestionContenidoInvitacion from './components/GestionContenidoInvitacion';
import InformeMensualConsolidado from './components/InformeMensualConsolidado';
import DashboardCursos from './components/DashboardCursos';
import DashboardPrecursores from './components/DashboardPrecursores';
import { AsignacionesReunion } from './components/AsignacionesReunion';
import ProgramaServiciosAuxiliares from './components/ProgramaServiciosAuxiliares';
import VidaYMinisterio from './components/VidaYMinisterio';
import RegistroTransaccion from './components/RegistroTransaccion';
import ReunionPublica from './components/ReunionPublica';
import HomeDashboard from './components/HomeDashboard';
import Vigilancia from './components/Vigilancia';
import VisitaSC from './components/VisitaSC';
import ProgramaPredicacionSemanal from './components/ProgramaPredicacionSemanal';
import { DISCURSOS_PUBLICOS } from './components/discursos';
import Carousel from './components/Carousel';
import InteractiveMap from './components/InteractiveMap';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Import from new shared files
import {
    UserRole, View, Permission, GranularPermission, UserData, Publisher,
    ServiceReport, AsistenciaData, AttendanceRecord, TerritoryRecord,
    TerritoryMap, TerritoryResponsible, DailyTerritoryAssignment, TerritoryMarker,
    InvitationContent, HomepageContent, MeetingAssignmentSchedule,
    DayAssignment, LMMeetingSchedule, LMWeekAssignment, PioneerApplication,
    OutgoingTalkAssignment, PublicTalksSchedule, PublicTalkAssignment, SpecialEvent, Campaign, MeetingConfig,
    VigilanciaConfig, ModalInfo, VisitaSCData, FieldServiceSchedule
} from './types';
import { MONTHS, SERVICE_YEAR_MONTHS, ALL_PERMISSIONS, DEFAULT_AVATAR } from './constants';
import { compressImage, downloadFile, blobToBase64 } from './utils';

declare const db: any;
declare const auth: any;
declare const firebase: any;
declare const storage: any;

const App: React.FC = () => {
    const [user, setUser] = useState<UserData | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [appConfig, setAppConfig] = useState<{ is15HourOptionEnabled: boolean; isPublicReportFormEnabled: boolean; } | null>(null);
    const [meetingConfig, setMeetingConfig] = useState<MeetingConfig | null>(null);
    const [initialization, setInitialization] = useState({ authChecked: false, configLoaded: false, publicDataLoaded: false });
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>('home');
    const [publicView, setPublicView] = useState<string>('home');
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [dataLoadError, setDataLoadError] = useState<string | null>(null);
    const [isPlayStoreApp, setIsPlayStoreApp] = useState(false);

    // Data states
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
    const [territoryRecords, setTerritoryRecords] = useState<TerritoryRecord[]>([]);
    const [territoryMaps, setTerritoryMaps] = useState<TerritoryMap[]>([]);
    const [territoryResponsible, setTerritoryResponsible] = useState<TerritoryResponsible | null>(null);
    const [dailyTerritoryAssignments, setDailyTerritoryAssignments] = useState<DailyTerritoryAssignment[]>([]);
    const [territoryMarkers, setTerritoryMarkers] = useState<TerritoryMarker[]>([]);
    const [schedules, setSchedules] = useState<MeetingAssignmentSchedule[]>([]);
    const [lmSchedules, setLmSchedules] = useState<LMMeetingSchedule[]>([]);
    const [publicTalksSchedule, setPublicTalksSchedule] = useState<PublicTalksSchedule>({});
    const [homepageContent, setHomepageContent] = useState<HomepageContent[]>([]);
    const [invitationContent, setInvitationContent] = useState<InvitationContent[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [fieldServiceSchedules, setFieldServiceSchedules] = useState<FieldServiceSchedule[]>([]);

    // Private data states
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [committeeMembers, setCommitteeMembers] = useState<string[]>([]);
    const [pioneerApplications, setPioneerApplications] = useState<PioneerApplication[]>([]);
    const [vigilanciaSchedules, setVigilanciaSchedules] = useState<any[]>([]);
    const [vigilanciaConfig, setVigilanciaConfig] = useState<VigilanciaConfig | null>(null);
    const [visitaSCData, setVisitaSCData] = useState<VisitaSCData[]>([]);
    const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);

    // New state to track individual public data loading status
    const [publicDataStatus, setPublicDataStatus] = useState({
        publishers: false,
        serviceReports: false,
        territoryRecords: false,
        territoryMaps: false,
        territoryResponsible: false,
        dailyAssignments: false,
        schedules: false,
        lmSchedules: false,
        publicTalks: false,
        homepage: false,
        invitation: false,
        territoryMarkers: false,
        fieldServiceSchedules: false,
    });

    const safePublicTalksSchedule = useMemo(() => {
        return publicTalksSchedule || {};
    }, [publicTalksSchedule]);

    // Derived loading state
    const loading = !initialization.authChecked || !initialization.configLoaded || !meetingConfig || !vigilanciaConfig || !initialization.publicDataLoaded;

    // Derived state for permissions
    const canManage = useMemo(() => {
        if (!user) return false;
        const role = user.role.toLowerCase();
        return role === 'admin' || role === 'secretario' || user.isCommitteeMember;
    }, [user]);

    const userPermissions = useMemo<Permission[]>(() => {
        if (!user) return [];
        const role = user.role.toLowerCase();
        // Grant all permissions to admin, secretary, AND committee members for robustness.
        if (role === 'admin' || role === 'secretario' || user.isCommitteeMember) {
            return ALL_PERMISSIONS;
        }
        return user.permissions || [];
    }, [user]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view') as View;
        const date = params.get('date');
        const presentacion = params.get('presentacion');

        const isApp = params.get('app') === 'playstore';
        if (isApp) {
            setIsPlayStoreApp(true);
            setActiveView('home'); 
        }

        if (view === 'visitaSC' && date) {
            setActiveView('visitaSC');
        }
    }, []);

    // Master initialization effect for auth, user profile, and global config.
    useEffect(() => {
        let isMounted = true;
        let userProfileUnsubscribe: (() => void) | null = null; // To store the snapshot listener

        const authUnsubscribe = auth.onAuthStateChanged((firebaseUser: any) => {
            if (!isMounted) return;

            // Clean up previous user listener if a different user logs in/out
            if (userProfileUnsubscribe) {
                userProfileUnsubscribe();
                userProfileUnsubscribe = null;
            }

            if (firebaseUser) {
                // User is logged in, set up a real-time listener for their profile
                const userDocRef = db.collection('users').doc(firebaseUser.uid);

                userProfileUnsubscribe = userDocRef.onSnapshot(async (userDoc: any) => {
                    if (!isMounted) return;
                    // Connection is good, clear any previous error banner.
                    setConnectionError(null);
                    try {
                        const committeeDoc = await db.collection('settings').doc('service_committee').get();

                        const userData = userDoc.data() || {};
                        const committeeUIDs = committeeDoc.data()?.members || [];
                        const isMember = committeeUIDs.includes(firebaseUser.uid);

                        const currentUser: UserData = {
                            id: firebaseUser.uid,
                            email: firebaseUser.email,
                            role: userData.role || 'publisher',
                            permissions: userData.permissions || [],
                            isCommitteeMember: isMember,
                            authUid: firebaseUser.uid,
                            publisherId: userData.publisherId || null,
                        };

                        setUser(currentUser);
                        setIsLoginModalOpen(false);
                        // Mark auth as checked once we have the user profile
                        if (!initialization.authChecked) {
                            setInitialization(prev => ({ ...prev, authChecked: true }));
                        }
                    } catch (error) {
                        console.error("Error fetching committee data for user profile:", error);
                        if (isMounted) {
                            setModalInfo({ type: 'error', title: 'Error de Perfil', message: 'No se pudieron cargar los datos complementarios de su perfil.' });
                            auth.signOut();
                        }
                    }
                }, (error: any) => { // Error callback for onSnapshot
                    console.error("User profile listener failed:", error);
                    if (isMounted) {
                        if (error.code === 'permission-denied') {
                            setModalInfo({ type: 'error', title: 'Error de Permisos', message: 'No tiene permiso para acceder a sus datos. La sesión se cerrará.' });
                            auth.signOut();
                        } else {
                            setConnectionError('Se perdió la conexión con los datos del perfil. Intentando reconectar...');
                        }
                    }
                });
            } else {
                // User is logged out
                setUser(null);
                setConnectionError(null);
                // Mark auth check as complete for logged-out users
                if (isMounted && !initialization.authChecked) {
                    setInitialization(prev => ({ ...prev, authChecked: true }));
                }
            }
        });

        const configUnsubscribe = db.collection('settings').doc('config').onSnapshot((doc: any) => {
            if (!isMounted) return;
            const configData = doc.data() || {};
            setAppConfig({
                is15HourOptionEnabled: configData.is15HourOptionEnabled || false,
                isPublicReportFormEnabled: configData.isPublicReportFormEnabled || false,
            });
            setInitialization(prev => ({ ...prev, configLoaded: true }));
        }, (err: Error) => {
            if (!isMounted) return;
            console.error("Global config listener failed:", err);
            setAppConfig({ is15HourOptionEnabled: false, isPublicReportFormEnabled: false });
            setInitialization(prev => ({ ...prev, configLoaded: true }));
        });

        const meetingConfigUnsubscribe = db.collection('settings').doc('meeting_config').onSnapshot((doc: any) => {
            if (!isMounted) return;
            const data = doc.data();
            setMeetingConfig({
                midweekDay: data?.midweekDay ?? 2, // Default Tuesday
                midweekTime: data?.midweekTime ?? '19:30',
                weekendDay: data?.weekendDay ?? 6, // Default Saturday
                weekendTime: data?.weekendTime ?? '16:30',
                specialEvents: data?.specialEvents ?? []
            });
        }, (err: Error) => {
            if (!isMounted) return;
            console.error("Meeting config listener failed:", err);
            setMeetingConfig({ // Provide safe defaults on error
                midweekDay: 2, midweekTime: '19:30', weekendDay: 6, weekendTime: '16:30', specialEvents: []
            });
        });

        const vigilanciaConfigUnsubscribe = db.collection('settings').doc('vigilancia_config').onSnapshot((doc: any) => {
            if (!isMounted) return;
            const data = doc.data();
            setVigilanciaConfig({
                tuesdaySlots: data?.tuesdaySlots ?? ["7:20-7:50pm", "7:50-8:20pm", "8:20-8:50pm", "8:50-9:20pm"],
                saturdaySlots: data?.saturdaySlots ?? ["4:15-4:50pm", "4:50-5:20pm", "5:20-5:50pm", "5:50-6:20pm"],
                congregations: data?.congregations ?? ["Jardines de Andalucia", "Las Jacarandas", "Nacozari", "Cerro de la Silla", "Niños Heroes"]
            });
        }, (err: Error) => {
            if (!isMounted) return;
            console.error("Vigilancia config listener failed:", err);
            setVigilanciaConfig({
                tuesdaySlots: ["7:20-7:50pm", "7:50-8:20pm", "8:20-8:50pm", "8:50-9:20pm"],
                saturdaySlots: ["4:15-4:50pm", "4:50-5:20pm", "5:20-5:50pm", "5:50-6:20pm"],
                congregations: ["Jardines de Andalucia", "Las Jacarandas", "Nacozari", "Cerro de la Silla", "Niños Heroes"]
            });
        });

        return () => {
            isMounted = false;
            authUnsubscribe();
            configUnsubscribe();
            meetingConfigUnsubscribe();
            vigilanciaConfigUnsubscribe();
            if (userProfileUnsubscribe) {
                userProfileUnsubscribe();
            }
        };
    }, []);

    // Effect for fetching PUBLIC data. Runs immediately on mount.
    useEffect(() => {
        const unsubscribers = [
            db.collection('publishers').onSnapshot((snapshot: any) => {
                setPublishers(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setDataLoadError(null); // Clear error on successful load
                setPublicDataStatus(prev => ({ ...prev, publishers: true }));
            }, (err: Error) => {
                console.error("CRITICAL: Listener for 'publishers' failed:", err);
                setDataLoadError("No se pudieron cargar los datos de publicadores. Esta es una función esencial. La causa más probable es que las reglas de seguridad de Firestore no permiten la lectura pública. Revise las instrucciones en index.html y la configuración de su proyecto de Firebase.");
                setPublicDataStatus(prev => ({ ...prev, publishers: true })); // Still mark as "loaded" to unblock UI
            }),
            db.collection('service_reports').onSnapshot((snapshot: any) => {
                setServiceReports(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, serviceReports: true }));
            }, (err: Error) => {
                console.error("Public Service Reports listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, serviceReports: true }));
            }),
            db.collection('territory_records').onSnapshot((snapshot: any) => {
                setTerritoryRecords(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, territoryRecords: true }));
            }, (err: Error) => {
                console.error("Public Territory listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, territoryRecords: true }));
            }),
            db.collection('territory_maps').orderBy('uploadedAt', 'desc').onSnapshot((snapshot: any) => {
                setTerritoryMaps(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, territoryMaps: true }));
            }, (err: Error) => {
                console.error("Public Territory Maps listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, territoryMaps: true }));
            }),
            db.collection('meeting_schedules').onSnapshot((snapshot: any) => {
                const allSchedules = snapshot.docs.map((doc: any) => ({ ...doc.data() as MeetingAssignmentSchedule, id: doc.id }));
                allSchedules.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month);
                });
                setSchedules(allSchedules);
                setPublicDataStatus(prev => ({ ...prev, schedules: true }));
            }, (err: Error) => {
                console.error("Public Meeting Schedules listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, schedules: true }));
            }),
            db.collection('lm_schedules').onSnapshot((snapshot: any) => {
                const allLmSchedules = snapshot.docs.map((doc: any) => ({ ...doc.data() as LMMeetingSchedule, id: doc.id }));
                allLmSchedules.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month);
                });
                setLmSchedules(allLmSchedules);
                setPublicDataStatus(prev => ({ ...prev, lmSchedules: true }));
            }, (err: Error) => {
                console.error("Public LM Schedules listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, lmSchedules: true }));
            }),
            db.collection('public_talks_schedule').doc('schedule').onSnapshot((doc: any) => {
                setPublicTalksSchedule(doc.data() || { outgoingTalks: [] });
                setPublicDataStatus(prev => ({ ...prev, publicTalks: true }));
            }, (err: Error) => {
                console.error("Public Talks listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, publicTalks: true }));
            }),
            db.collection('homepage_content').onSnapshot((snapshot: any) => {
                setHomepageContent(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, homepage: true }));
            }, (err: Error) => {
                console.error("Public Homepage Content listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, homepage: true }));
            }),
            db.collection('invitation_content').onSnapshot((snapshot: any) => {
                setInvitationContent(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, invitation: true }));
            }, (err: Error) => {
                console.error("Public Invitation Content listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, invitation: true }));
            }),
            db.collection('settings').doc('territory_responsible').onSnapshot((doc: any) => {
                setTerritoryResponsible(doc.data() || null);
                setPublicDataStatus(prev => ({ ...prev, territoryResponsible: true }));
            }, (err: Error) => {
                console.error("Territory Responsible listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, territoryResponsible: true }));
            }),
            db.collection('daily_territory_assignments').orderBy('date', 'desc').onSnapshot((snapshot: any) => {
                setDailyTerritoryAssignments(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, dailyAssignments: true }));
            }, (err: Error) => {
                console.error("Daily Territory Assignments listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, dailyAssignments: true }));
            }),
            db.collection('territory_markers').onSnapshot((snapshot: any) => {
                setTerritoryMarkers(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, territoryMarkers: true }));
            }, (err: Error) => {
                console.error("Territory Markers listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, territoryMarkers: true }));
            }),
            db.collection('visita_sc').onSnapshot((snapshot: any) => {
                setVisitaSCData(snapshot.docs.map((doc: any) => ({ ...doc.data() as VisitaSCData, id: doc.id })));
            }, (err: Error) => {
                console.error("Visita SC listener failed:", err);
            }),
            db.collection('campaigns').orderBy('startDate', 'desc').onSnapshot((snapshot: any) => {
                setCampaigns(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })));
            }, (err: Error) => {
                console.error("Campaigns listener failed:", err);
            }),
            db.collection('field_service_schedules').orderBy('date', 'desc').onSnapshot((snapshot: any) => {
                setFieldServiceSchedules(snapshot.docs.map((doc: any) => ({ ...doc.data() as FieldServiceSchedule, id: doc.id })));
                setPublicDataStatus(prev => ({ ...prev, fieldServiceSchedules: true }));
            }, (err: Error) => {
                console.error("Field Service Schedules listener failed:", err);
                setPublicDataStatus(prev => ({ ...prev, fieldServiceSchedules: true }));
            }),
        ];

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, []);

    // Effect to check if all public data is loaded
    useEffect(() => {
        const allPublicDataLoaded = Object.values(publicDataStatus).every(status => status === true);
        if (allPublicDataLoaded) {
            setInitialization(prev => ({ ...prev, publicDataLoaded: true }));
        }
    }, [publicDataStatus]);

    // Effect for fetching PRIVATE data, dependent on user authentication and app initialization.
    useEffect(() => {
        if (loading || !user) {
            setVigilanciaSchedules([]);
            setAttendanceRecords([]);
            setUsers([]);
            setCommitteeMembers([]);
            setPioneerApplications([]);
            return;
        }

        const unsubscribers = [
            db.collection('vigilancia_schedules').onSnapshot((snapshot: any) => setVigilanciaSchedules(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }))), (err: Error) => console.error("Vigilancia Schedules listener failed:", err)),
            db.collection('attendance').onSnapshot((snapshot: any) => setAttendanceRecords(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }))), (err: Error) => console.error("Attendance listener failed:", err)),
            db.collection('users').onSnapshot((snapshot: any) => setUsers(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }))), (err: Error) => console.error("Users listener failed:", err)),
            db.collection('settings').doc('service_committee').onSnapshot((doc: any) => setCommitteeMembers(doc.data()?.members || []), (err: Error) => console.error("Committee listener failed:", err)),
            db.collection('pioneer_applications').onSnapshot((snapshot: any) => setPioneerApplications(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }))), (err: Error) => console.error("Pioneer Applications listener failed:", err)),
        ];

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [user, loading]);

    // --- Handlers for database mutations ---

    const handleLogout = () => {
        auth.signOut();
    };

    const handleSaveAttendance = async (year: number, month: string, data: AsistenciaData) => {
        const docId = `${year}_${month}`;
        try {
            await db.collection('attendance').doc(docId).set({ ano: year, mes: month, ...data }, { merge: true });
            setModalInfo({ type: 'success', title: 'Éxito', message: 'El informe de asistencia se ha guardado correctamente.' });
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error al Guardar', message: `No se pudo guardar el informe: ${(error as Error).message}` });
            throw error;
        }
    };

    const handleBatchUpdateAttendance = async (records: AttendanceRecord[]) => {
        const batch = db.batch();
        records.forEach(record => {
            const { id, ...data } = record;
            const docRef = db.collection('attendance').doc(id);
            batch.set(docRef, data, { merge: true });
        });
        try {
            await batch.commit();
            setModalInfo({ type: 'success', title: 'Éxito', message: 'Los registros de asistencia se han actualizado correctamente.' });
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error al Actualizar', message: `No se pudieron actualizar los registros: ${(error as Error).message}` });
            throw error;
        }
    };

    const handleAddPublisher = async (publisher: Omit<Publisher, 'id'>) => {
        try {
            const { Foto, ['Carta de presentacion']: Carta, ...rest } = publisher;
            const dataToSave: any = { ...rest };

            if (Foto instanceof Blob) {
                try {
                    const uniqueFileName = `${Date.now()}_photo.webp`;
                    const storageRef = storage.ref(`publisher_photos/${uniqueFileName}`);
                    const uploadTask = storageRef.put(Foto, { contentType: 'image/webp' });
                    await uploadTask;
                    dataToSave.Foto = await uploadTask.snapshot.ref.getDownloadURL();
                } catch (e: any) {
                    console.warn("Storage falló (Foto), usando Base64 fallback:", e);
                    dataToSave.Foto = await blobToBase64(Foto);
                }
            } else {
                dataToSave.Foto = Foto || null;
            }

            if (Carta instanceof File || Carta instanceof Blob) {
                try {
                    const uniqueFileName = `${Date.now()}_letter.pdf`;
                    const storageRef = storage.ref(`publisher_letters/${uniqueFileName}`);
                    const uploadTask = storageRef.put(Carta, { contentType: 'application/pdf' });
                    await uploadTask;
                    dataToSave['Carta de presentacion'] = await uploadTask.snapshot.ref.getDownloadURL();
                } catch (e: any) {
                    console.warn("Storage falló (Carta), usando Base64 fallback:", e);
                    dataToSave['Carta de presentacion'] = await blobToBase64(Carta);
                }
            } else {
                dataToSave['Carta de presentacion'] = Carta || null;
            }

            await db.collection('publishers').add(dataToSave);
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: (error as Error).message });
            throw error;
        }
    };

    const handleUpdatePublisher = async (publisher: Publisher) => {
        try {
            const { id, Foto, ['Carta de presentacion']: Carta, ...rest } = publisher;
            const dataToUpdate: any = { ...rest };

            if (Foto instanceof Blob) {
                try {
                    const uniqueFileName = `${Date.now()}_photo.webp`;
                    const storageRef = storage.ref(`publisher_photos/${uniqueFileName}`);
                    const uploadTask = storageRef.put(Foto, { contentType: 'image/webp' });
                    await uploadTask;
                    dataToUpdate.Foto = await uploadTask.snapshot.ref.getDownloadURL();
                } catch (e: any) {
                    console.warn("Storage falló (Foto Update), usando Base64 fallback:", e);
                    dataToUpdate.Foto = await blobToBase64(Foto);
                }
            } else {
                dataToUpdate.Foto = Foto || null;
            }

            if (Carta instanceof File || Carta instanceof Blob) {
                try {
                    const uniqueFileName = `${Date.now()}_letter.pdf`;
                    const storageRef = storage.ref(`publisher_letters/${uniqueFileName}`);
                    const uploadTask = storageRef.put(Carta, { contentType: 'application/pdf' });
                    await uploadTask;
                    dataToUpdate['Carta de presentacion'] = await uploadTask.snapshot.ref.getDownloadURL();
                } catch (e: any) {
                    console.warn("Storage falló (Carta Update), usando Base64 fallback:", e);
                    dataToUpdate['Carta de presentacion'] = await blobToBase64(Carta);
                }
            } else {
                dataToUpdate['Carta de presentacion'] = Carta || null;
            }

            await db.collection('publishers').doc(id).update(dataToUpdate);
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: (error as Error).message });
            throw error;
        }
    };

    const handleDeletePublisher = async (id: string) => {
        await db.collection('publishers').doc(id).delete();
    };

    const handleSaveServiceReport = async (report: Omit<ServiceReport, 'id'>) => {
        const sanitizedReport = sanitizeForFirebase(report);
        const query = await db.collection('service_reports')
            .where('idPublicador', '==', sanitizedReport.idPublicador)
            .where('anioCalendario', '==', sanitizedReport.anioCalendario)
            .where('mes', '==', sanitizedReport.mes)
            .get();

        if (query.empty) {
            await db.collection('service_reports').add(sanitizedReport);
        } else {
            await db.collection('service_reports').doc(query.docs[0].id).update(sanitizedReport);
        }
    };

    const handleBatchUpdateServiceReports = async (reports: Omit<ServiceReport, 'id'>[]) => {
        const batch = db.batch();
        for (const report of reports) {
            const sanitizedReport = sanitizeForFirebase(report);
            const query = await db.collection('service_reports')
                .where('idPublicador', '==', sanitizedReport.idPublicador)
                .where('anioCalendario', '==', sanitizedReport.anioCalendario)
                .where('mes', '==', sanitizedReport.mes)
                .limit(1)
                .get();

            if (query.empty) {
                const newDocRef = db.collection('service_reports').doc();
                batch.set(newDocRef, sanitizedReport);
            } else {
                const docRef = db.collection('service_reports').doc(query.docs[0].id);
                batch.update(docRef, sanitizedReport);
            }
        }
        await batch.commit();
    };

    const handleDeleteServiceReport = async (reportId: string) => {
        await db.collection('service_reports').doc(reportId).delete();
    };

    const handleUpdateGroup = async (publisherId: string, newGroup: string) => {
        await db.collection('publishers').doc(publisherId).update({ Grupo: newGroup });
    };

    const handleSaveTerritoryRecord = async (record: Omit<TerritoryRecord, 'id'>) => {
        // Ensure numeric types for critical fields to prevent sorting/filtering issues
        const terrNum = Number(record.terrNum);
        const vueltaNum = Number(record.vueltaNum);
        const serviceYear = Number(record.serviceYear);

        const sanitizedRecord = {
            ...record,
            terrNum,
            vueltaNum,
            serviceYear
        };

        const query = await db.collection('territory_records')
            .where('terrNum', '==', terrNum)
            .where('vueltaNum', '==', vueltaNum)
            .where('serviceYear', '==', serviceYear)
            .get();

        if (query.empty) {
            await db.collection('territory_records').add(sanitizedRecord);
        } else {
            await db.collection('territory_records').doc(query.docs[0].id).update(sanitizedRecord);
        }
    };

    const handleDeleteTerritoryRecord = async (record: Partial<TerritoryRecord>) => {
        if (record.id) {
            await db.collection('territory_records').doc(record.id).delete();
        } else {
            const query = await db.collection('territory_records')
                .where('terrNum', '==', record.terrNum)
                .where('vueltaNum', '==', record.vueltaNum)
                .where('serviceYear', '==', record.serviceYear)
                .get();
            if (!query.empty) {
                await db.collection('territory_records').doc(query.docs[0].id).delete();
            }
        }
    };

    const handleUploadTerritoryMap = async (territoryId: string, imageFile: Blob) => {
        const fileName = `${territoryId}_${Date.now()}.webp`;
        let mapUrl = '';
        try {
            const storageRef = storage.ref(`territory_maps/${fileName}`);
            const uploadTask = storageRef.put(imageFile, { contentType: 'image/webp' });
            await uploadTask;
            mapUrl = await uploadTask.snapshot.ref.getDownloadURL();
        } catch (e: any) {
            console.warn("Storage falló (Mapa de Territorio), usando Base64 fallback:", e);
            mapUrl = await blobToBase64(imageFile);
        }

        const existingMapQuery = await db.collection('territory_maps').where('territoryId', '==', territoryId).get();

        if (!existingMapQuery.empty) {
            const docId = existingMapQuery.docs[0].id;
            const oldMapUrl = existingMapQuery.docs[0].data().mapUrl;
            if (oldMapUrl && oldMapUrl !== mapUrl) {
                try { await storage.refFromURL(oldMapUrl).delete(); } catch (e) { console.warn("Old map file not found or could not be deleted, continuing update."); }
            }
            await db.collection('territory_maps').doc(docId).update({
                mapUrl,
                fileName: fileName,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await db.collection('territory_maps').add({
                territoryId,
                mapUrl,
                fileName: fileName,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    };

    const handleDeleteTerritoryMap = async (mapId: string, mapUrl: string) => {
        if (mapUrl) {
            try {
                await storage.refFromURL(mapUrl).delete();
            } catch (error) {
                console.error("Error deleting file from storage, might be already deleted:", error);
            }
        }
        await db.collection('territory_maps').doc(mapId).delete();
    };

    const handleSaveTerritoryResponsible = async (publisherId: string, publisherName: string) => {
        if (!user?.isCommitteeMember) {
            setModalInfo({ type: 'error', title: 'Permiso Denegado', message: 'Solo los miembros del comité de servicio pueden asignar el responsable de territorio.' });
            throw new Error('Permission denied');
        }

        const responsibleData: TerritoryResponsible = {
            publisherId,
            publisherName,
            assignedDate: new Date().toISOString().split('T')[0],
            assignedBy: user.id
        };

        await db.collection('settings').doc('territory_responsible').set(responsibleData);
        setModalInfo({ type: 'success', title: 'Éxito', message: `${publisherName} ha sido asignado como responsable de territorio.` });
    };

    const handleSaveDailyAssignment = async (assignment: Omit<DailyTerritoryAssignment, 'id' | 'createdAt'>) => {
        if (!user) {
            setModalInfo({ type: 'error', title: 'Error', message: 'Debe iniciar sesión para crear asignaciones.' });
            throw new Error('User not logged in');
        }

        const assignmentData = {
            ...assignment,
            createdBy: user.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('daily_territory_assignments').add(assignmentData);
        setModalInfo({ type: 'success', title: 'Éxito', message: 'Asignación diaria guardada correctamente.' });
    };

    const handleUpdateDailyAssignment = async (id: string, assignment: Partial<DailyTerritoryAssignment>) => {
        const { id: _, createdAt, createdBy, ...updateData } = assignment as any;
        await db.collection('daily_territory_assignments').doc(id).update(updateData);
        setModalInfo({ type: 'success', title: 'Éxito', message: 'Asignación actualizada correctamente.' });
    };

    const handleDeleteDailyAssignment = async (id: string) => {
        await db.collection('daily_territory_assignments').doc(id).delete();
        setModalInfo({ type: 'success', title: 'Éxito', message: 'Asignación eliminada correctamente.' });
    };

    const handleSaveTerritoryMarker = async (marker: Omit<TerritoryMarker, 'id'> & { id?: string }) => {
        const { id, ...data } = marker;
        const dataToSave = {
            ...data,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await db.collection('territory_markers').doc(id).set(dataToSave, { merge: true });
        } else {
            await db.collection('territory_markers').add(dataToSave);
        }
    };

    const handleDeleteTerritoryMarker = async (id: string) => {
        await db.collection('territory_markers').doc(id).delete();
    };

    // --- Access Control Handlers ---
    const handleUpdateUserPermissions = (userId: string, permissions: Permission[]) => {
        return db.collection('users').doc(userId).update({ permissions });
    };
    const handleUpdateServiceCommittee = (memberUids: string[]) => {
        return db.collection('settings').doc('service_committee').set({ members: memberUids });
    };
    const handleLinkUserToPublisher = async (userId: string, publisherId: string) => {
        const batch = db.batch();
        batch.update(db.collection('users').doc(userId), { publisherId: publisherId });
        batch.update(db.collection('publishers').doc(publisherId), { authUid: userId });
        await batch.commit();
    };
    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm("¿Está seguro de que desea eliminar este usuario?")) return;
        try {
            const batch = db.batch();
            batch.delete(db.collection('users').doc(userId));
            
            // Also find and unlink any publisher linked to this UID
            const linkedPublisher = publishers.find(p => p.authUid === userId);
            if (linkedPublisher) {
                batch.update(db.collection('publishers').doc(linkedPublisher.id), { authUid: firebase.firestore.FieldValue.delete() });
            }
            
            await batch.commit();
            setModalInfo({ type: 'success', title: 'Éxito', message: 'Usuario eliminado correctamente de la base de datos y desvinculado del publicador.' });
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: `No se pudo eliminar el usuario: ${(error as Error).message}` });
        }
    };
    const handleUpdatePublicReportFormEnabled = (isEnabled: boolean) => {
        return db.collection('settings').doc('config').set({ isPublicReportFormEnabled: isEnabled }, { merge: true });
    };
    const handleSaveMeetingConfig = (config: MeetingConfig) => {
        return db.collection('settings').doc('meeting_config').set(config, { merge: true });
    };
    const handleResetData = async () => {
        if (user?.role !== 'admin') {
            setModalInfo({ type: 'error', title: 'Permiso Denegado', message: 'Solo los administradores pueden realizar esta acción.' });
            return;
        }
        if (!window.confirm("¡ADVERTENCIA! ¿Está absolutamente seguro de que desea borrar TODOS los datos de la congregación? Esta acción es irreversible y eliminará informes, publicadores, asignaciones, etc.")) {
            return;
        }
        if (!window.confirm("CONFIRMACIÓN FINAL: ¿Está 100% seguro? Todos los datos se perderrán para siempre.")) {
            return;
        }

        // Renaming to avoid shadowing 'loading' state
        let isProcessing = true;
        // set a local loading state if needed, or just inform user
        setModalInfo({ type: 'info', title: 'Procesando', message: 'Eliminando todos los datos...' });

        try {
            const collectionsToDelete = [
                'publishers', 'service_reports', 'attendance', 'territory_records',
                'pioneer_applications', 'meeting_schedules', 'lm_schedules'
            ];

            for (const collectionName of collectionsToDelete) {
                const snapshot = await db.collection(collectionName).get();
                const batch = db.batch();
                snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
                await batch.commit();
            }
            setModalInfo({ type: 'success', title: 'Éxito', message: 'Todos los datos de la congregación han sido eliminados.' });
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: `No se pudieron eliminar los datos: ${(error as Error).message}` });
        } finally {
            isProcessing = false;
        }
    };

    const handleAddInvitation = async (imageFile: Blob, phrase: string) => {
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
        let imageUrl = '';
        try {
            const storageRef = storage.ref(`invitation_images/${uniqueFileName}`);
            const uploadTask = storageRef.put(imageFile, { contentType: 'image/webp' });
            await uploadTask;
            imageUrl = await uploadTask.snapshot.ref.getDownloadURL();
        } catch (e) {
            console.warn("Storage falló (Invitación), usando Base64 fallback:", e);
            imageUrl = await blobToBase64(imageFile);
        }
        await db.collection('invitation_content').add({ imageUrl, phrase, fileName: uniqueFileName });
    };

    const handleSaveCampaign = async (campaign: Omit<Campaign, 'id'> & { id?: string }) => {
        const { id, ...data } = campaign;
        if (id) {
            await db.collection('campaigns').doc(id).set(data, { merge: true });
        } else {
            await db.collection('campaigns').add(data);
        }
        setModalInfo({ type: 'success', title: 'Éxito', message: 'Campaña guardada correctamente.' });
    };

    const handleDeleteCampaign = async (id: string) => {
        await db.collection('campaigns').doc(id).delete();
        setModalInfo({ type: 'success', title: 'Éxito', message: 'Campaña eliminada correctamente.' });
    };
    const handleDeleteInvitation = (contentId: string) => db.collection('invitation_content').doc(contentId).delete();

    const handleSaveFieldServiceSchedule = async (schedule: Omit<FieldServiceSchedule, 'id'> & { id?: string }) => {
        const { id, ...data } = schedule;
        if (id) {
            await db.collection('field_service_schedules').doc(id).set(data, { merge: true });
        } else {
            await db.collection('field_service_schedules').add(data);
        }
    };

    const handleDeleteFieldServiceSchedule = async (id: string) => {
        await db.collection('field_service_schedules').doc(id).delete();
    };

    const handleAddHomepageContent = async (imageFile: Blob, title: string, phrase: string) => {
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
        let imageUrl = '';
        try {
            const storageRef = storage.ref(`homepage_images/${uniqueFileName}`);
            const uploadTask = storageRef.put(imageFile, { contentType: 'image/webp' });
            await uploadTask;
            imageUrl = await uploadTask.snapshot.ref.getDownloadURL();
        } catch (e) {
            console.warn("Storage falló (Carousel), usando Base64 fallback:", e);
            imageUrl = await blobToBase64(imageFile);
        }
        await db.collection('homepage_content').add({ imageUrl, title, phrase, fileName: uniqueFileName });
    };
    const handleDeleteHomepageContent = (contentId: string) => db.collection('homepage_content').doc(contentId).delete();

    const handleUpdate15HourOption = (isEnabled: boolean) => {
        return db.collection('settings').doc('config').set({ is15HourOptionEnabled: isEnabled }, { merge: true });
    };

    const handleSaveMeetingSchedule = async (schedule: Omit<MeetingAssignmentSchedule, 'id'>) => {
        const docId = `${schedule.year}-${schedule.month}`;
        await db.collection('meeting_schedules').doc(docId).set(schedule, { merge: true });
    };

    const sanitizeForFirebase = (obj: any): any => {
        if (obj === undefined) {
            return null;
        }
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeForFirebase(item));
        }
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                newObj[key] = sanitizeForFirebase(value);
            }
        }
        return newObj;
    };

    const handleSaveLMSchedule = (schedule: Omit<LMMeetingSchedule, 'id'> & { month: string; year: number }) => {
        const docId = `${schedule.year}-${schedule.month}`;
        const sanitizedSchedule = sanitizeForFirebase(schedule);
        return db.collection('lm_schedules').doc(docId).set(sanitizedSchedule, { merge: true });
    };

    const handleUpdatePublisherVyMAssignments = (publisherId: string, assignments: { [key: string]: boolean }) => {
        return db.collection('publishers').doc(publisherId).update(assignments);
    };
    const handleSavePublicTalksSchedule = async (schedule: PublicTalksSchedule) => {
        await db.collection('public_talks_schedule').doc('schedule').set(schedule, { merge: true });
    };

    const handleSaveVigilanciaSchedule = async (schedule: any) => {
        const docId = schedule.id;
        if (!docId) {
            console.error("Save failed: schedule is missing an ID.");
            throw new Error("El programa a guardar no tiene ID.");
        }
        const { id, ...dataToSave } = schedule;
        await db.collection('vigilancia_schedules').doc(docId).set(dataToSave, { merge: true });
    };

    const handleSaveVigilanciaConfig = (config: VigilanciaConfig) => {
        return db.collection('settings').doc('vigilancia_config').set(config, { merge: true });
    };

    const handleDownload = async (url: string, fileName: string) => {
        await downloadFile(url, fileName, (error) => {
            setModalInfo({ type: 'error', title: 'Error de Descarga', message: 'No se pudo descargar el archivo. Por favor, intente de nuevo.' });
        });
    };

    const canManageTerritories = useMemo(() => {
        if (canManage) return true;
        return (!!user?.publisherId && !!territoryResponsible && user.publisherId === territoryResponsible.publisherId);
    }, [canManage, user, territoryResponsible]);

    const ALL_COMPONENTS: { [key in View]: React.ReactElement } = {
        home: <HomeDashboard
            lmSchedules={lmSchedules}
            schedules={schedules}
            publicTalksSchedule={publicTalksSchedule}
            publishers={publishers}
            onShowModal={setModalInfo}
            setActiveView={setActiveView}
            meetingConfig={meetingConfig!}
            homepageContent={homepageContent}
        />,
        asistenciaForm: <AsistenciaForm attendanceRecords={attendanceRecords} onSave={handleSaveAttendance} />,
        asistenciaReporte: <AsistenciaReporte attendanceRecords={attendanceRecords} onBatchUpdateAttendance={handleBatchUpdateAttendance} canEdit={userPermissions.includes('editAsistenciaReporte')} />,
        publicadores: <Publicadores publishers={publishers} serviceReports={serviceReports} onAdd={handleAddPublisher} onUpdate={handleUpdatePublisher} onDelete={handleDeletePublisher} onShowModal={setModalInfo} canManage={userPermissions.includes('managePublicadores')} onDownload={handleDownload} />,
        registrosServicio: <RegistrosServicio publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} onDeleteServiceReport={handleDeleteServiceReport} canEdit={userPermissions.includes('editRegistrosServicio')} />,
        grupos: <Grupos publishers={publishers} onUpdateGroup={handleUpdateGroup} canManage={userPermissions.includes('manageGrupos')} />,
        informeServicio: <InformeServicio publishers={publishers} serviceReports={serviceReports} onSaveReport={handleSaveServiceReport} onApplyForPioneer={() => setActiveView('precursorAuxiliar')} invitationContent={invitationContent} isLoggedIn={true} />,
        territorios: <Territorios
            records={territoryRecords}
            onSave={handleSaveTerritoryRecord}
            onDelete={handleDeleteTerritoryRecord}
            territoryMaps={territoryMaps}
            onUploadMap={handleUploadTerritoryMap}
            onDeleteMap={handleDeleteTerritoryMap}
            canManage={canManageTerritories}
            onShowModal={setModalInfo}
            onDownload={handleDownload}
            territoryResponsible={territoryResponsible}
            onSaveTerritoryResponsible={handleSaveTerritoryResponsible}
            dailyAssignments={dailyTerritoryAssignments}
            onSaveDailyAssignment={handleSaveDailyAssignment}
            onUpdateDailyAssignment={handleUpdateDailyAssignment}
            onDeleteDailyAssignment={handleDeleteDailyAssignment}
            territoryMarkers={territoryMarkers}
            onSaveTerritoryMarker={handleSaveTerritoryMarker}
            onDeleteTerritoryMarker={handleDeleteTerritoryMarker}
            publishers={publishers}
            isCommitteeMember={user?.isCommitteeMember || false}
            campaigns={campaigns}
            onSaveCampaign={handleSaveCampaign}
            onDeleteCampaign={handleDeleteCampaign}
        />,
        precursorAuxiliar: <PrecursorAuxiliar userRole={user?.role || 'publisher'} isCommitteeMember={user?.isCommitteeMember || false} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} publishers={publishers} />,
        controlAcceso: <ControlAcceso users={users} publishers={publishers} committeeMembers={committeeMembers} onUpdateUserPermissions={handleUpdateUserPermissions} onUpdateServiceCommittee={handleUpdateServiceCommittee} onLinkUserToPublisher={handleLinkUserToPublisher} onDeleteUser={handleDeleteUser} isPublicReportFormEnabled={appConfig?.isPublicReportFormEnabled || false} onUpdatePublicReportFormEnabled={handleUpdatePublicReportFormEnabled} onResetData={handleResetData} currentUserRole={user?.role || 'publisher'} canManage={canManage} meetingConfig={meetingConfig} onSaveMeetingConfig={handleSaveMeetingConfig} />,
        informeMensualGrupo: <InformeMensualGrupo publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} />,
        gestionContenidoInvitacion: <GestionContenidoInvitacion onShowModal={setModalInfo} invitationContent={invitationContent} onAddInvitation={handleAddInvitation} onDeleteInvitation={handleDeleteInvitation} homepageContent={homepageContent} onAddHomepageContent={handleAddHomepageContent} onDeleteHomepageContent={handleDeleteHomepageContent} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} onUpdate15HourOption={handleUpdate15HourOption} onDownload={handleDownload} />,
        informeMensualConsolidado: <InformeMensualConsolidado publishers={publishers} serviceReports={serviceReports} />,
        dashboardCursos: <DashboardCursos publishers={publishers} serviceReports={serviceReports} />,
        dashboardPrecursores: <DashboardPrecursores publishers={publishers} serviceReports={serviceReports} pioneerApplications={pioneerApplications} />,
        seguimientoInformes: <SeguimientoInformes publishers={publishers} serviceReports={serviceReports} onShowModal={setModalInfo} />,
        asignacionesReunion: <AsignacionesReunion
            publishers={publishers}
            schedules={schedules}
            onSaveSchedule={handleSaveMeetingSchedule}
            onShowModal={setModalInfo}
            canManageSchedule={userPermissions.includes('manageMeetingAssignments')}
            meetingConfig={meetingConfig!}
        />,
        programaServiciosAuxiliares: <ProgramaServiciosAuxiliares schedules={schedules} publishers={publishers} onShowModal={setModalInfo} meetingConfig={meetingConfig!} />,
        vidaYMinisterio: <VidaYMinisterio publishers={publishers} lmSchedules={lmSchedules} onSaveSchedule={handleSaveLMSchedule} onUpdatePublisherVyMAssignments={handleUpdatePublisherVyMAssignments} onShowModal={setModalInfo} canConfig={userPermissions.includes('configVidaYMinisterio')} />,
        registroTransaccion: <RegistroTransaccion />,
        reunionPublica: <ReunionPublica schedule={safePublicTalksSchedule} onSave={handleSavePublicTalksSchedule} canManage={userPermissions.includes('managePublicTalks')} publishers={publishers} onShowModal={setModalInfo} onUpdatePublisher={handleUpdatePublisher} />,
        vigilancia: <Vigilancia schedules={vigilanciaSchedules} onSave={handleSaveVigilanciaSchedule} config={vigilanciaConfig!} onSaveConfig={handleSaveVigilanciaConfig} />,
        visitaSC: <VisitaSC
            publishers={publishers}
            lmSchedules={lmSchedules}
            visitaData={visitaSCData}
            onSaveVisita={async (data) => {
                const { id, ...rest } = data;
                await db.collection('visita_sc').doc(id).set(rest, { merge: true });
                setModalInfo({ type: 'success', title: 'Guardado', message: 'Datos de la visita del SC guardados correctamente.' });
            }}
            onShowModal={setModalInfo}
            attendanceRecords={attendanceRecords}
            territoryRecords={territoryRecords}
            serviceReports={serviceReports}
            territoryResponsible={territoryResponsible}
            territoryMarkers={territoryMarkers}
            territoryMaps={territoryMaps}
        />,
        programaPredicacionSemanal: <ProgramaPredicacionSemanal
            schedules={fieldServiceSchedules}
            publishers={publishers}
            territoryMarkers={territoryMarkers}
            territoryMaps={territoryMaps}
            territoryRecords={territoryRecords}
            onSave={handleSaveFieldServiceSchedule}
            onDelete={handleDeleteFieldServiceSchedule}
            onShowModal={setModalInfo}
            canManage={canManage}
        />,
    };

    const NAV_ITEMS = useMemo<{ view: View; label: string }[]>(() => [
        { view: 'home', label: 'Inicio' },
        { view: 'informeServicio', label: 'Informar Servicio' },
        { view: 'precursorAuxiliar', label: 'Prec. Auxiliar' },
        { view: 'vidaYMinisterio', label: 'Prog. Vida y Ministerio' },
        { view: 'asignacionesReunion', label: 'Generar Prog. Acomodadores' },
        { view: 'reunionPublica', label: 'Reunión Pública' },
        { view: 'programaPredicacionSemanal', label: 'Programa de Predicación' },
        { view: 'programaServiciosAuxiliares', label: 'Prog de Acomodadores' },
        { view: 'asistenciaForm', label: 'Form. Asistencia' },
        { view: 'asistenciaReporte', label: 'Reporte Anual Asistencia' },
        { view: 'publicadores', label: 'Publicadores' },
        { view: 'registrosServicio', label: 'Tarjetas de Publicador' },
        { view: 'dashboardCursos', label: 'Dashboard de Cursos' },
        { view: 'dashboardPrecursores', label: 'Dashboard Precursores' },
        { view: 'informeMensualGrupo', label: 'Informe Mensual' },
        { view: 'informeMensualConsolidado', label: 'Informe a la Sucursal' },
        { view: 'grupos', label: 'Grupos' },
        { view: 'territorios', label: 'Territorios' },
        { view: 'vigilancia', label: 'Vigilancia' },
        { view: 'gestionContenidoInvitacion', label: 'Contenido Invitación' },
        { view: 'controlAcceso', label: 'Control de Accesso' },
        { view: 'seguimientoInformes', label: 'Seguimiento de Informes' },
        { view: 'registroTransaccion', label: 'Registro Transacción' },
        { view: 'visitaSC', label: 'Visita del SC' },
    ], []);

    const activeViewLabel = useMemo(() => {
        const navItem = NAV_ITEMS.find(item => item.view === activeView);
        return navItem ? navItem.label : 'Inicio';
    }, [activeView]);

    const linkedPublisher = useMemo(() => {
        if (!user || !publishers.length) return null;
        return publishers.find(p => p.authUid === user.id);
    }, [user, publishers]);

    const userCanAccessView = useMemo(() => {
        // Admins, secretaries and committee members have full access to everything
        const role = user?.role?.toLowerCase();
        if (role === 'admin' || role === 'secretario' || user?.isCommitteeMember) {
            return true;
        }

        // These views are always available to any logged-in user, regardless of specific permissions.
        const alwaysVisible: View[] = ['home', 'informeServicio', 'precursorAuxiliar', 'programaServiciosAuxiliares'];
        if (alwaysVisible.includes(activeView)) {
            return true;
        }

        // Special case: 'Generar Prog. Acomodadores' is unlocked by the 'manageMeetingAssignments' permission.
        if (activeView === 'asignacionesReunion') {
            return userPermissions.includes('manageMeetingAssignments');
        }

        // For all other views, check for a direct permission matching the view name.
        return userPermissions.includes(activeView);
    }, [activeView, userPermissions, user]);

    const ErrorBanner = ({ message }: { message: string }) => (
        <div className="bg-red-600 text-white text-center p-4 z-20 shadow-lg">
            <h3 className="font-bold text-lg">Error Crítico de Carga de Datos</h3>
            <p className="text-sm mt-1">{message}</p>
            <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-1 border-2 border-white rounded-md font-semibold hover:bg-red-700 transition-colors"
            >
                Recargar Página
            </button>
        </div>
    );

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div></div>;
    }

    const params = new URLSearchParams(window.location.search);
    const isStandalonePage = params.get('presentacion') === '1' && params.get('view') === 'visitaSC';

    if (isStandalonePage) {
        return (
            <div className="h-screen w-screen overflow-hidden bg-slate-900">
                <VisitaSC
                    publishers={publishers}
                    lmSchedules={lmSchedules}
                    visitaData={visitaSCData}
                    onSaveVisita={async (data) => {
                        const { id, ...rest } = data;
                        await db.collection('visita_sc').doc(id).set(rest, { merge: true });
                        setModalInfo({ type: 'success', title: 'Guardado', message: 'Datos de la visita del SC guardados correctamente.' });
                    }}
                    onShowModal={setModalInfo}
                    attendanceRecords={attendanceRecords}
                    territoryRecords={territoryRecords}
                    territoryMarkers={territoryMarkers}
                    territoryMaps={territoryMaps}
                    serviceReports={serviceReports}
                    territoryResponsible={territoryResponsible}
                    isStandalone={true}
                />
                {modalInfo && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100] p-4" onClick={() => setModalInfo(null)}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className={`p-6 text-center border-t-8 rounded-lg ${modalInfo.type === 'success' ? 'border-green-500' :
                                modalInfo.type === 'error' ? 'border-red-500' : 'border-blue-500'
                                }`}>
                                <h3 className="text-xl font-bold mb-4">{modalInfo.title}</h3>
                                <p className="text-gray-600 whitespace-pre-wrap">{modalInfo.message}</p>
                                <button onClick={() => setModalInfo(null)} className="mt-6 px-6 py-2 bg-gray-200 rounded-md">Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!user) {
        const PUBLIC_NAV_ITEMS: { view: string; label: string }[] = [
            { view: 'home', label: 'Inicio' },
            { view: 'informeServicio', label: 'Informar Servicio' },
            { view: 'precursorAuxiliar', label: 'Prec. Auxiliar' },
            { view: 'vidaYMinisterio', label: 'Prog. Vida y Ministerio' },
            { view: 'programaServiciosAuxiliares', label: 'Prog de Acomodadores' },
            { view: 'programaPredicacionSemanal', label: 'Programa de Predicación' },
            { view: 'territorios', label: 'Territorios' },
            { view: 'reunionPublica', label: 'Reunión Pública' },
            { view: 'dashboardCursos', label: 'Dashboard Cursos' },
        ];

        const PublicHome = ({ 
            homepageContent, 
            publicTalksSchedule,
            territoryMarkers,
            territoryRecords,
            territoryMaps
        }: { 
            homepageContent: HomepageContent[]; 
            publicTalksSchedule: PublicTalksSchedule;
            territoryMarkers: TerritoryMarker[];
            territoryRecords: TerritoryRecord[];
            territoryMaps: TerritoryMap[];
        }) => {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();
            const serviceYear = currentMonth >= 8 ? currentYear + 1 : currentYear;
            const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
            
            const currentVueltaWorked = useMemo(() => {
                const yearRecords = territoryRecords.filter(r => r.serviceYear === serviceYear && r.completedDate);
                if (yearRecords.length === 0) return [];
                // Use the highest vuelta that has at least one completion
                const maxV = Math.max(...yearRecords.map(r => r.vueltaNum));
                return territoryRecords.filter(r => r.vueltaNum === maxV && r.serviceYear === serviceYear && r.completedDate).map(r => r.terrNum).sort((a, b) => a - b);
            }, [territoryRecords, serviceYear]);

            const maxVuelta = useMemo(() => {
                const yearRecords = territoryRecords.filter(r => r.serviceYear === serviceYear);
                if (yearRecords.length === 0) return 1;
                
                const vueltas = yearRecords.map(r => r.vueltaNum);
                const maxV = Math.max(...vueltas);
                
                // Damping logic: if the highest vuelta has very few records (accidents)
                // and the previous vuelta has more records, stay in the previous one.
                const countInMax = yearRecords.filter(r => r.vueltaNum === maxV).length;
                if (maxV > 1 && countInMax < 5) {
                    const countInPrev = yearRecords.filter(r => r.vueltaNum === maxV - 1).length;
                    if (countInPrev > 5) return maxV - 1;
                }

                return maxV;
            }, [territoryRecords, serviceYear]);
            
            const latestSchedule = useMemo(() => {
                if (fieldServiceSchedules.length === 0) return null;
                return fieldServiceSchedules[0];
            }, [fieldServiceSchedules]);

            const generatePublicReport = async () => {
                if (isGeneratingPDF) return;
                setIsGeneratingPDF(true);
                try {
                    const doc = new jsPDF('p', 'mm', 'letter');
                    const pageWidth = doc.internal.pageSize.getWidth();
                const globalMap = territoryMaps.find(m => m.territoryId === 'global');
                const numberedMap = territoryMaps.find(m => m.territoryId === 'global-numerado');
                const captain = latestSchedule ? publishers.find(p => p.id === latestSchedule.captainId) : null;

                const HEADER_HEIGHT = 40;
                const MARGIN = 15;
                let y = 0;

                // --- Page 1: Interactive Map ---
                doc.setFillColor(0, 32, 96);
                doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text('REPORTE DE PREDICACIÓN', pageWidth / 2, 15, { align: 'center' });
                doc.setFontSize(10);
                doc.text(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), pageWidth / 2, 22, { align: 'center' });

                if (captain) {
                    doc.setFontSize(10);
                    doc.text(`CAPITÁN: ${captain.Nombre} ${captain.Apellido}`.toUpperCase(), MARGIN, 32);
                    if (captain.Foto) {
                        try {
                            // Fix squashing: Use square dimensions for the photo
                            doc.addImage(captain.Foto, 'WEBP', pageWidth - MARGIN - 25, 5, 25, 25, undefined, 'FAST');
                        } catch (e) {}
                    }
                }

                if (globalMap) {
                    try {
                        const mapY = HEADER_HEIGHT + 5;
                        const availableWidth = pageWidth - (MARGIN * 2);
                        
                        // Robust image loading
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        await new Promise((resolve) => {
                            img.onload = resolve;
                            img.onerror = resolve;
                            img.src = globalMap.mapUrl;
                        });

                        const imgWidth = img.naturalWidth || 1000;
                        const imgHeight = img.naturalHeight || 600;
                        const aspectRatio = imgHeight / imgWidth;
                        
                        // Calculate height to maintain aspect ratio
                        const calculatedHeight = availableWidth * aspectRatio;
                        
                        // Limit height to fit on page (max 180mm to fill more space)
                        const finalMapHeight = Math.min(calculatedHeight, 180);
                        
                        // Use calculated width to match the aspect ratio if we limited the height
                        const finalMapWidth = finalMapHeight / aspectRatio;
                        const offsetX = (availableWidth - finalMapWidth) / 2;

                        doc.addImage(globalMap.mapUrl, 'WEBP', MARGIN + offsetX, mapY, finalMapWidth, finalMapHeight, undefined, 'FAST');
                        
                        // Draw markers with adjusted scale and position
                        territoryMarkers.forEach(m => {
                            const markerX = MARGIN + offsetX + (m.x / 100) * finalMapWidth;
                            const markerY = mapY + (m.y / 100) * finalMapHeight;
                            
                            doc.setFillColor(
                                m.status === 'completed' ? 34 : (m.status === 'assigned' ? 239 : (m.status === 'delayed' ? 249 : 107)),
                                m.status === 'completed' ? 197 : (m.status === 'assigned' ? 68 : (m.status === 'delayed' ? 115 : 114)),
                                m.status === 'completed' ? 94 : (m.status === 'assigned' ? 68 : (m.status === 'delayed' ? 22 : 128))
                            );
                            doc.circle(markerX, markerY, 2.5, 'F');
                            doc.setTextColor(255, 255, 255);
                            doc.setFontSize(6);
                            doc.setFont('helvetica', 'bold');
                            doc.text(m.terrNum.toString(), markerX, markerY, { align: 'center', baseline: 'middle' });
                        });
                        y = mapY + finalMapHeight + 10;
                    } catch (e) {
                        y = 165;
                    }
                } else {
                    y = 165;
                }

                doc.setTextColor(0, 32, 96);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`TERRITORIOS TRABAJADOS (VUELTA ${maxVuelta}):`, MARGIN, y);
                y += 7;
                
                const workedList = currentVueltaWorked.join(', ') || 'Ninguno';
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(workedList, MARGIN, y, { maxWidth: pageWidth - (MARGIN * 2) });

                // --- Page 2: Global Numbered Map ---
                doc.addPage();
                doc.setFillColor(0, 32, 96);
                doc.rect(0, 0, pageWidth, 20, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text('MAPA GLOBAL NUMERADO', pageWidth / 2, 12, { align: 'center' });

                if (numberedMap) {
                    try {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        await new Promise((resolve) => {
                            img.onload = resolve;
                            img.onerror = resolve;
                            img.src = numberedMap.mapUrl;
                        });

                        const imgWidth = img.naturalWidth || 1000;
                        const imgHeight = img.naturalHeight || 600;
                        const aspectRatio = imgHeight / imgWidth;
                        const availableWidth = pageWidth - (MARGIN * 2);
                        
                        // Limit to fit page (max 200mm)
                        const finalMapHeight = Math.min(availableWidth * aspectRatio, 200);
                        const finalMapWidth = finalMapHeight / aspectRatio;
                        const offsetX = (availableWidth - finalMapWidth) / 2;

                        doc.addImage(numberedMap.mapUrl, 'WEBP', MARGIN + offsetX, 25, finalMapWidth, finalMapHeight, undefined, 'FAST');
                        y = 25 + finalMapHeight + 10;
                    } catch (e) {
                        y = 185;
                    }
                } else {
                    y = 185;
                }

                const allTerrs = Array.from({ length: 40 }, (_, i) => i + 1);
                const available = allTerrs.filter(n => !currentVueltaWorked.includes(n));

                autoTable(doc, {
                    startY: y,
                    head: [['ESTADO', 'NÚMEROS']],
                    body: [
                        ['TRABAJADOS', currentVueltaWorked.join(', ') || 'NINGUNO'],
                        ['DISPONIBLES', available.join(', ') || 'NINGUNO']
                    ],
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 3 },
                    headStyles: { fillColor: [0, 32, 96] },
                    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } }
                });

                doc.save(`Reporte_Predicacion_Cerro_${new Date().toISOString().split('T')[0]}.pdf`);
                } finally {
                    setIsGeneratingPDF(false);
                }
            };

            const isWithinReportRange = () => {
                const today = new Date();
                const day = today.getDate();
                return day >= 25 || day <= 15;
            };

            const upcomingTalk = useMemo(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let nextTalk: (PublicTalkAssignment & { talkNumber: number }) | null = null;
                let nextDate = new Date('9999-12-31');

                const visibilityMap = publicTalksSchedule.publicVisibility || {};

                Object.entries(publicTalksSchedule).forEach(([talkNumStr, assignments]) => {
                    if (Array.isArray(assignments)) {
                        assignments.forEach(a => {
                            if (a && a.date) {
                                const talkDate = new Date(a.date + 'T00:00:00');
                                const yearMonthKey = `${talkDate.getFullYear()}-${MONTHS[talkDate.getMonth()]}`;

                                // Only consider if the month is public
                                if (visibilityMap[yearMonthKey] && talkDate >= today && talkDate < nextDate) {
                                    nextDate = talkDate;
                                    nextTalk = { ...a, talkNumber: parseInt(talkNumStr, 10) };
                                }
                            }
                        });
                    }
                });
                return nextTalk;
            }, [publicTalksSchedule]);

            return (
                <div className="space-y-8 fade-in-up">
                    {/* Carousel Section for Public View */}
                    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-10">
                        <Carousel slides={homepageContent} />
                    </div>

                    <div className="max-w-6xl mx-auto px-4 pb-12">
                        {/* Interactive Map for Public */}
                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 mb-12">
                            <h2 className="text-3xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                <span className="p-3 bg-blue-100 text-blue-600 rounded-2xl">🗺️</span>
                                Mapa de Territorios
                            </h2>
                            <div className="flex gap-4 mb-6">
                                <button 
                                    onClick={generatePublicReport}
                                    disabled={isGeneratingPDF}
                                    className={`px-6 py-2 bg-slate-900 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 text-sm active:scale-95 ${isGeneratingPDF ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                                >
                                    {isGeneratingPDF ? '⏳ Generando...' : '📥 Descargar Reporte PDF'}
                                </button>
                            </div>
                                <InteractiveMap 
                                    maps={territoryMaps}
                                    markers={territoryMarkers}
                                    records={territoryRecords}
                                    canManage={false}
                                    onShowModal={setModalInfo}
                                    currentServiceYear={serviceYear}
                                />
                            
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                    <h3 className="text-lg font-black text-blue-800 mb-2">Vuelta en curso: #{maxVuelta || 1}</h3>
                                    <p className="text-blue-600 text-sm font-medium">Información actualizada del progreso de predicación en Cerro de la Silla.</p>
                                </div>
                                <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                                    <h3 className="text-lg font-black text-green-800 mb-2">Territorios Trabajados: {currentVueltaWorked.length}</h3>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {currentVueltaWorked.map(num => (
                                            <span key={num} className="px-3 py-1 bg-white text-green-600 rounded-full text-xs font-black border border-green-200">
                                                {num}
                                            </span>
                                        ))}
                                        {currentVueltaWorked.length === 0 && <span className="text-green-600 italic text-sm">Aún no hay territorios completados en esta vuelta.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Upcoming Talk Section */}
                        {upcomingTalk && (
                            <div className="glass p-8 rounded-[2.5rem] shadow-xl mb-12 border border-white/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-purple-500/20 transition-all"></div>
                                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center text-4xl shadow-lg text-purple-600">
                                        🎙️
                                    </div>
                                    <div className="text-center md:text-left flex-1">
                                        <h3 className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-1">Próxima Reunión Pública</h3>
                                        <p className="text-3xl font-black text-slate-800 mb-2">
                                            {new Date(upcomingTalk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </p>
                                        <p className="text-xl text-slate-700 font-medium mb-1">
                                            {upcomingTalk.talkNumber}. {DISCURSOS_PUBLICOS.find(t => t.number === upcomingTalk.talkNumber)?.title}
                                        </p>
                                        <p className="text-slate-500">
                                            Orador: <span className="font-semibold">{upcomingTalk.speakerName}</span>
                                        </p>
                                        {upcomingTalk.song && (
                                            <p className="text-slate-500 mt-1">
                                                Canción: <span className="font-semibold text-purple-700">{upcomingTalk.song}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {appConfig?.isPublicReportFormEnabled && isWithinReportRange() && (
                            <div className="glass p-8 rounded-[2.5rem] shadow-xl text-center mb-12 border border-white/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                                <span className="inline-block p-4 bg-blue-600 text-white rounded-3xl text-3xl mb-4 shadow-lg shadow-blue-200">📝</span>
                                <h3 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">¡Tiempo de Informar!</h3>
                                <p className="text-slate-600 mb-8 max-w-md mx-auto text-lg">Envía tu informe de servicio mensual ahora mismo de forma sencilla.</p>
                                <button
                                    onClick={() => setPublicView('informeServicio')}
                                    className="px-12 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all transform hover:scale-[1.05] shadow-2xl shadow-blue-300 flex items-center justify-center mx-auto gap-3 uppercase tracking-widest text-sm"
                                >
                                    Enviar Mi Informe
                                </button>
                            </div>
                        )}

                        <div className="glass p-8 rounded-[2.5rem] shadow-xl text-center mb-12 border border-white/50 relative overflow-hidden group bg-gradient-to-br from-white to-amber-50/30">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full -ml-32 -mt-32 blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
                            <h3 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">¿Deseas ser Precursor Auxiliar?</h3>
                            <p className="text-slate-600 mb-8 max-w-lg mx-auto text-lg">Únete a los muchos hermanos que están expandiendo su ministerio. ¡Envía tu solicitud aquí mismo!</p>
                            <button
                                onClick={() => setPublicView('precursorAuxiliar')}
                                className="px-12 py-5 bg-amber-500 text-white font-black rounded-2xl hover:bg-amber-600 transition-all transform hover:scale-[1.05] shadow-2xl shadow-amber-300 flex items-center justify-center mx-auto gap-3 uppercase tracking-widest text-sm"
                            >
                                Llenar Solicitud de Precursor
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                            <div className="glass p-8 rounded-[2rem] border border-white/40 shadow-xl flex flex-col items-center text-center group hover:border-blue-300 transition-all">
                                <div className="p-4 bg-orange-100 rounded-2xl mb-4 group-hover:scale-110 transition-transform">📅</div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Vida y Ministerio</h3>
                                <p className="text-slate-500 text-sm mb-6">Consulta las asignaciones de la reunión de entre semana.</p>
                                <button onClick={() => setPublicView('vidaYMinisterio')} className="text-blue-600 font-bold hover:underline">Ver Programa →</button>
                            </div>
                            <div className="glass p-8 rounded-[2rem] border border-white/40 shadow-xl flex flex-col items-center text-center group hover:border-blue-300 transition-all">
                                <div className="p-4 bg-green-100 rounded-2xl mb-4 group-hover:scale-110 transition-transform">🛡️</div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Prog de Acomodadores</h3>
                                <p className="text-slate-500 text-sm mb-6">Visualiza los turnos de acomodadores, micrófonos y aseo.</p>
                                <button onClick={() => setPublicView('programaServiciosAuxiliares')} className="text-blue-600 font-bold hover:underline">Ver Programa →</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        let publicContent;
        switch (publicView) {
            case 'vidaYMinisterio':
                publicContent = <VidaYMinisterio publishers={publishers} lmSchedules={lmSchedules.filter(s => s.isPublic)} onSaveSchedule={async () => { }} onUpdatePublisherVyMAssignments={async () => { }} onShowModal={setModalInfo} canConfig={false} />;
                break;
            case 'asignacionesReunion':
                publicContent = <AsignacionesReunion publishers={publishers} schedules={schedules.filter(s => s.isPublic)} onSaveSchedule={async () => { }} onShowModal={setModalInfo} canManageSchedule={false} meetingConfig={meetingConfig!} />;
                break;
            case 'reunionPublica':
                publicContent = <ReunionPublica schedule={publicTalksSchedule} onSave={async () => { }} canManage={false} publishers={publishers} onShowModal={setModalInfo} onUpdatePublisher={async () => { }} />;
                break;
            case 'programaServiciosAuxiliares':
                publicContent = <ProgramaServiciosAuxiliares schedules={schedules.filter(s => s.isPublic)} publishers={publishers} onShowModal={setModalInfo} meetingConfig={meetingConfig!} />;
                break;
            case 'dashboardCursos':
                publicContent = <DashboardCursos publishers={publishers} serviceReports={serviceReports} />;
                break;
            case 'territorios':
                publicContent = <Territorios
                    records={territoryRecords}
                    onSave={handleSaveTerritoryRecord}
                    onDelete={handleDeleteTerritoryRecord}
                    territoryMaps={territoryMaps}
                    onUploadMap={handleUploadTerritoryMap}
                    onDeleteMap={handleDeleteTerritoryMap}
                    canManage={false}
                    onShowModal={setModalInfo}
                    territoryResponsible={territoryResponsible}
                    onSaveTerritoryResponsible={async () => { }}
                    dailyAssignments={dailyTerritoryAssignments}
                    onSaveDailyAssignment={async () => { }}
                    onUpdateDailyAssignment={async () => { }}
                    onDeleteDailyAssignment={async () => { }}
                    territoryMarkers={territoryMarkers}
                    onSaveTerritoryMarker={async () => { }}
                    onDeleteTerritoryMarker={async () => { }}
                    publishers={publishers}
                    isCommitteeMember={false}
                    campaigns={campaigns}
                    onSaveCampaign={async () => { }}
                    onDeleteCampaign={async () => { }}
                />;
                break;
            case 'precursorAuxiliar':
                publicContent = <PrecursorAuxiliar userRole="publisher" isCommitteeMember={false} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} publishers={publishers} />;
                break;
            case 'informeServicio':
                publicContent = <InformeServicio publishers={publishers} serviceReports={serviceReports} onSaveReport={handleSaveServiceReport} onApplyForPioneer={() => setPublicView('precursorAuxiliar')} invitationContent={invitationContent} isLoggedIn={true} />;
                break;
            case 'home':
            default:
                publicContent = (
                    <PublicHome 
                        homepageContent={homepageContent} 
                        publicTalksSchedule={publicTalksSchedule} 
                        territoryMarkers={territoryMarkers}
                        territoryRecords={territoryRecords}
                        territoryMaps={territoryMaps}
                    />
                );
        }

        return (
            <div className="h-screen bg-[#f8fafc] flex flex-col font-['Inter']">
                {dataLoadError && <ErrorBanner message={dataLoadError} />}

                {/* Modern Public Header */}
                <header className="bg-white/70 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 p-4 sm:px-8 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <span className="text-white text-xl">🏠</span>
                        </div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Congregación <span className="text-blue-600">Cerro</span></h1>
                    </div>
                    <button
                        onClick={() => setIsLoginModalOpen(true)}
                        className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200 flex items-center gap-2 text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Iniciar Sesión
                    </button>
                </header>

                {/* Styled Public Navigation */}
                <nav className="bg-white border-b border-slate-100 sticky top-[73px] z-20 overflow-x-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8">
                        <div className="flex space-x-2 py-2">
                            {PUBLIC_NAV_ITEMS.map(item => (
                                <button
                                    key={item.view}
                                    onClick={() => setPublicView(item.view)}
                                    className={`py-2.5 px-5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${publicView === item.view
                                        ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </nav>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
                    {publicContent}
                </main>
                {isLoginModalOpen && <Login onClose={() => setIsLoginModalOpen(false)} />}
                {modalInfo && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={() => setModalInfo(null)}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className={`p-6 text-center border-t-8 rounded-lg ${modalInfo.type === 'success' ? 'border-green-500' :
                                modalInfo.type === 'error' ? 'border-red-500' : 'border-blue-500'
                                }`}>
                                <h3 className="text-xl font-bold mb-4">{modalInfo.title}</h3>
                                <p className="text-gray-600 whitespace-pre-wrap">{modalInfo.message}</p>
                                <button onClick={() => setModalInfo(null)} className="mt-6 px-6 py-2 bg-gray-200 rounded-md">Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const userProfileForHeader = {
        displayName: linkedPublisher ? `${linkedPublisher.Nombre} ${linkedPublisher.Apellido}` : user.email,
        email: user.email,
        photoURL: linkedPublisher?.Foto || DEFAULT_AVATAR
    };




    return (
        <ErrorBoundary>
            <div className="flex h-screen bg-gray-100 overflow-hidden">
                {/* Play Store App Bottom Navigation */}
                {isPlayStoreApp && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center py-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                        <button 
                            onClick={() => setActiveView('home')} 
                            className={`flex flex-col items-center gap-1 transition-all ${activeView === 'home' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
                        >
                            <span className="text-xl">🏠</span>
                            <span className="text-[10px] font-bold tracking-tight">Inicio</span>
                        </button>
                        <button 
                            onClick={() => setActiveView('informeServicio')} 
                            className={`flex flex-col items-center gap-1 transition-all ${activeView === 'informeServicio' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
                        >
                            <span className="text-xl">📝</span>
                            <span className="text-[10px] font-bold tracking-tight">Informe</span>
                        </button>
                        <button 
                            onClick={() => setActiveView('precursorAuxiliar')} 
                            className={`flex flex-col items-center gap-1 transition-all ${activeView === 'precursorAuxiliar' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
                        >
                            <span className="text-xl">💼</span>
                            <span className="text-[10px] font-bold tracking-tight">Prec. Aux.</span>
                        </button>
                        <button 
                            onClick={() => setActiveView('territorios')} 
                            className={`flex flex-col items-center gap-1 transition-all ${activeView === 'territorios' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
                        >
                            <span className="text-xl">🗺️</span>
                            <span className="text-[10px] font-bold tracking-tight">Territ.</span>
                        </button>
                    </div>
                )}

                {!isPlayStoreApp && (
                    <Sidebar 
                        activeView={activeView} 
                        setActiveView={setActiveView} 
                        onLogout={handleLogout} 
                        userRole={user.role} 
                        userPermissions={userPermissions} 
                        isCommitteeMember={user.isCommitteeMember} 
                        isCollapsed={isSidebarCollapsed} 
                        setIsCollapsed={setIsSidebarCollapsed} 
                    />
                )}
                
                <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${!isPlayStoreApp ? (isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64') : 'pb-16'}`}>
                    {dataLoadError && <ErrorBanner message={dataLoadError} />}
                    {connectionError && (
                        <div className="bg-red-600 text-white text-center p-2 text-sm animate-pulse z-10">
                            {connectionError}
                        </div>
                    )}
                    <Header 
                        user={userProfileForHeader} 
                        activeViewLabel={isPlayStoreApp ? 'App Cerro' : activeViewLabel} 
                    />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6">
                        {userCanAccessView ? ALL_COMPONENTS[activeView] : (
                            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                                <h2 className="text-2xl font-bold text-red-600">Acceso Denegado</h2>
                                <p className="mt-2">No tiene permiso para ver esta sección.</p>
                            </div>
                        )}
                    </main>
                </div>

                {modalInfo && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={() => setModalInfo(null)}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className={`p-6 text-center border-t-8 rounded-lg ${modalInfo.type === 'success' ? 'border-green-500' :
                                modalInfo.type === 'error' ? 'border-red-500' : 'border-blue-500'
                                }`}>
                                <h3 className="text-xl font-bold mb-4">{modalInfo.title}</h3>
                                <p className="text-gray-600 whitespace-pre-wrap">{modalInfo.message}</p>
                                <button onClick={() => setModalInfo(null)} className="mt-6 px-6 py-2 bg-gray-200 rounded-md">Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

export default App;