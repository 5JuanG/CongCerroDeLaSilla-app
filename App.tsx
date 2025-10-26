import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import InformeMensualGrupo from './components/InformeMensualGrupo';
import GestionContenidoInvitacion from './components/GestionContenidoInvitacion';
import InformeMensualConsolidado from './components/InformeMensualConsolidado';
import DashboardCursos from './components/DashboardCursos';
import DashboardPrecursores from './components/DashboardPrecursores';
import AsignacionesReunion from './components/AsignacionesReunion';
import ProgramaServiciosAuxiliares from './components/ProgramaServiciosAuxiliares';
import VidaYMinisterio from './components/VidaYMinisterio';
import RegistroTransaccion from './components/RegistroTransaccion';
import ReunionPublica from './components/ReunionPublica';
import HomeDashboard from './components/HomeDashboard';
import Vigilancia from './components/Vigilancia';
import { DISCURSOS_PUBLICOS } from './components/discursos';
import Carousel from './components/Carousel';


declare const db: any;
declare const auth: any;
declare const firebase: any;
declare const storage: any;

export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const SERVICE_YEAR_MONTHS = [...MONTHS.slice(8), ...MONTHS.slice(0, 8)];

export type UserRole = 'admin' | 'overseer' | 'publisher' | 'helper' | 'auxiliary' | 'secretario';
export type View = 'asistenciaForm' | 'asistenciaReporte' | 'publicadores' | 'registrosServicio' | 'grupos' | 'informeServicio' | 'territorios' | 'precursorAuxiliar' | 'home' | 'controlAcceso' | 'informeMensualGrupo' | 'gestionContenidoInvitacion' | 'informeMensualConsolidado' | 'dashboardCursos' | 'dashboardPrecursores' | 'asignacionesReunion' | 'programaServiciosAuxiliares' | 'vidaYMinisterio' | 'registroTransaccion' | 'reunionPublica' | 'vigilancia';

export type GranularPermission = 
    'editAsistenciaReporte' |
    'managePublicadores' |
    'editRegistrosServicio' |
    'manageGrupos' |
    'configVidaYMinisterio' |
    'manageMeetingAssignments' |
    'managePublicTalks' |
    'resetData';

export type Permission = View | GranularPermission;

// FIX: Define ALL_PERMISSIONS constant to grant full access to admin/secretario roles.
export const ALL_PERMISSIONS: Permission[] = [
    // Views
    'asistenciaForm', 'asistenciaReporte', 'publicadores', 'registrosServicio', 'grupos', 
    'informeServicio', 'territorios', 'precursorAuxiliar', 'home', 'controlAcceso', 
    'informeMensualGrupo', 'gestionContenidoInvitacion', 'informeMensualConsolidado', 
    'dashboardCursos', 'dashboardPrecursores', 'asignacionesReunion', 
    'programaServiciosAuxiliares', 'vidaYMinisterio', 'registroTransaccion', 'reunionPublica', 'vigilancia',
    // Granular Permissions
    'editAsistenciaReporte', 'managePublicadores', 'editRegistrosServicio', 'manageGrupos',
    'configVidaYMinisterio', 'manageMeetingAssignments', 'managePublicTalks', 'resetData'
];

export interface UserData {
    id: string;
    email: string;
    role: UserRole;
    isCommitteeMember: boolean;
    permissions: Permission[];
    authUid?: string;
}

export interface Publisher {
    id: string;
    [key: string]: any; 
}

export interface ServiceReport {
    id: string;
    idPublicador: string;
    nombrePublicador?: string; // For public submissions
    anioCalendario: number;
    mes: string;
    participacion: boolean;
    precursorAuxiliar: string;
    horas?: number;
    cursosBiblicos?: number;
    notas?: string;
}

export interface AsistenciaData {
    es_sem1: string; es_sem2: string; es_sem3: string; es_sem4: string; es_sem5: string;
    fs_sem1: string; fs_sem2: string; fs_sem3: string; fs_sem4: string; fs_sem5: string;
}
export interface AttendanceRecord extends AsistenciaData {
    id: string;
    ano: number;
    mes: string;
}

export interface TerritoryRecord {
    id: string;
    terrNum: number;
    vueltaNum: number;
    serviceYear: number;
    asignadoA?: string;
    assignedDate?: string;
    completedDate?: string;
    observations?: string;
}

export interface TerritoryMap {
    id: string;
    territoryId: string;
    mapUrl: string;
    fileName: string;
    uploadedAt: any;
}

export interface InvitationContent {
    id: string;
    imageUrl: string;
    phrase: string;
}

export interface HomepageContent {
    id: string;
    imageUrl: string;
    title: string;
    phrase: string;
}

export interface MeetingAssignmentSchedule {
    id: string;
    year: number;
    month: string;
    schedule: { [dateKey: string]: DayAssignment };
    isPublic?: boolean;
}

export interface DayAssignment {
    fechaReunion?: string;
    reunionHorario?: string;
    vigilanciaHorario?: string;
    presidente?: string;
    conductorAtalaya?: string;
    lectorAtalaya?: string;
    acomodadoresPrincipal?: string[];
    acomodadoresAuditorio?: string[];
    acomodadoresSala?: string[];
    microfonos?: string[];
    vigilantes?: string[];
    aseo?: string;
    hospitalidad?: string;
}

export interface LMMeetingSchedule {
    id: string;
    year: number;
    month: string;
    weeks: LMWeekAssignment[];
    isPublic?: boolean;
}
export interface LMWeekAssignment {
    [key: string]: any;
}
export interface PioneerApplication {
    id: string;
    nombre: string;
    mes: string;
    deContinuo: boolean;
    status: 'Pendiente' | 'Aprobado';
}

export interface OutgoingTalkAssignment {
    id: string;
    speakerId: string;
    talkNumber: number;
    date: string;
    congregation: string;
}

export interface PublicTalksSchedule {
    [key: string]: any; // Allows for arbitrary talk numbers
    outgoingTalks?: OutgoingTalkAssignment[];
    publicVisibility?: { [yearMonth: string]: boolean };
}
export interface PublicTalkAssignment {
    date: string;
    speakerName: string;
    song: string;
    congregation?: string;
    phone?: string;
}

export interface SpecialEvent {
    id: string;
    date: string; // YYYY-MM-DD
    description: string;
}

export interface MeetingConfig {
    midweekDay: number; // 0 (Sun) - 6 (Sat)
    midweekTime: string; // HH:mm
    weekendDay: number;
    weekendTime: string;
    specialEvents: SpecialEvent[];
}

export interface ModalInfo {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

export const compressImage = (file: File, targetWidth: number = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            if (!event.target?.result) {
                return reject(new Error('No se pudo leer el archivo de imagen.'));
            }
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleFactor = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scaleFactor;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('No se pudo obtener el contexto del canvas.'));
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/webp', 0.85);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};

const App: React.FC = () => {
    const [user, setUser] = useState<UserData | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [appConfig, setAppConfig] = useState<{ is15HourOptionEnabled: boolean; isPublicReportFormEnabled: boolean; } | null>(null);
    const [meetingConfig, setMeetingConfig] = useState<MeetingConfig | null>(null);
    const [initialization, setInitialization] = useState({ authChecked: false, configLoaded: false });
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>('home');
    const [publicView, setPublicView] = useState<string>('home');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Data states
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
    const [territoryRecords, setTerritoryRecords] = useState<TerritoryRecord[]>([]);
    const [territoryMaps, setTerritoryMaps] = useState<TerritoryMap[]>([]);
    const [schedules, setSchedules] = useState<MeetingAssignmentSchedule[]>([]);
    const [lmSchedules, setLmSchedules] = useState<LMMeetingSchedule[]>([]);
    const [publicTalksSchedule, setPublicTalksSchedule] = useState<PublicTalksSchedule>({});
    const [vigilanciaSchedules, setVigilanciaSchedules] = useState<any[]>([]);
    const [homepageContent, setHomepageContent] = useState<HomepageContent[]>([]);
    
    // Private data states
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [committeeMembers, setCommitteeMembers] = useState<string[]>([]);
    const [invitationContent, setInvitationContent] = useState<InvitationContent[]>([]);
    const [pioneerApplications, setPioneerApplications] = useState<PioneerApplication[]>([]);
    const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);
    
    // Derived loading state
    const loading = !initialization.authChecked || !initialization.configLoaded || !meetingConfig;
    
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

        return () => {
            isMounted = false;
            authUnsubscribe();
            configUnsubscribe();
            meetingConfigUnsubscribe();
            if (userProfileUnsubscribe) {
                userProfileUnsubscribe();
            }
        };
    }, []);

    // Effect for fetching ALL data, now dependent on user authentication.
    useEffect(() => {
        // If we are loading or the user is logged out, clear all data and do nothing.
        if (loading || !user) {
            setPublishers([]);
            setServiceReports([]);
            setTerritoryRecords([]);
            setTerritoryMaps([]);
            setSchedules([]);
            setLmSchedules([]);
            setPublicTalksSchedule({});
            setVigilanciaSchedules([]);
            setHomepageContent([]);
            setAttendanceRecords([]);
            setUsers([]);
            setCommitteeMembers([]);
            setInvitationContent([]);
            setPioneerApplications([]);
            return;
        }

        // User is logged in, set up all listeners.
        const unsubscribers = [
            db.collection('publishers').onSnapshot((snapshot: any) => setPublishers(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Publishers listener failed:", err)),
            db.collection('service_reports').onSnapshot((snapshot: any) => setServiceReports(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Service Reports listener failed:", err)),
            db.collection('territory_records').onSnapshot((snapshot: any) => setTerritoryRecords(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Territory listener failed:", err)),
            db.collection('territory_maps').orderBy('uploadedAt', 'desc').onSnapshot((snapshot: any) => setTerritoryMaps(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Territory Maps listener failed:", err)),
            db.collection('meeting_schedules').onSnapshot((snapshot: any) => {
                const allSchedules = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() as MeetingAssignmentSchedule }));
                allSchedules.sort((a, b) => {
                    if (a.year !== b.year) {
                        return b.year - a.year;
                    }
                    return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month); 
                });
                setSchedules(allSchedules);
            }, (err: Error) => console.error("Meeting Schedules listener failed:", err)),
            db.collection('lm_schedules').onSnapshot((snapshot: any) => {
                const allLmSchedules = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() as LMMeetingSchedule }));
                allLmSchedules.sort((a, b) => {
                    if (a.year !== b.year) {
                        return b.year - a.year;
                    }
                    return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month);
                });
                setLmSchedules(allLmSchedules);
            }, (err: Error) => console.error("LM Schedules listener failed:", err)),
            db.collection('public_talks_schedule').doc('schedule').onSnapshot((doc: any) => setPublicTalksSchedule(doc.data() || { outgoingTalks: [] }), (err: Error) => console.error("Public Talks listener failed:", err)),
            db.collection('vigilancia_schedules').onSnapshot((snapshot: any) => setVigilanciaSchedules(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Vigilancia Schedules listener failed:", err)),
            db.collection('homepage_content').onSnapshot((snapshot: any) => setHomepageContent(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Homepage Content listener failed:", err)),
            db.collection('attendance').onSnapshot((snapshot: any) => setAttendanceRecords(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Attendance listener failed:", err)),
            db.collection('users').onSnapshot((snapshot: any) => setUsers(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Users listener failed:", err)),
            db.collection('settings').doc('service_committee').onSnapshot((doc: any) => setCommitteeMembers(doc.data()?.members || []), (err: Error) => console.error("Committee listener failed:", err)),
            db.collection('invitation_content').onSnapshot((snapshot: any) => setInvitationContent(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Invitation Content listener failed:", err)),
            db.collection('pioneer_applications').onSnapshot((snapshot: any) => setPioneerApplications(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))), (err: Error) => console.error("Pioneer Applications listener failed:", err)),
        ];

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [user, loading]); // This effect now correctly depends on the user and loading state.
    
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

            if (typeof Foto === 'string' && Foto.startsWith('data:')) {
                const storageRef = storage.ref(`publisher_photos/${Date.now()}_photo.webp`);
                const uploadTask = storageRef.putString(Foto, 'data_url', { contentType: 'image/webp' });
                await uploadTask; // Wait for upload to complete
                dataToSave.Foto = await uploadTask.snapshot.ref.getDownloadURL();
            } else {
                dataToSave.Foto = Foto || null;
            }

            if (Carta instanceof File) {
                const uniqueFileName = `${Date.now()}_letter.pdf`;
                const storageRef = storage.ref(`publisher_letters/${uniqueFileName}`);
                const uploadTask = storageRef.put(Carta, { contentType: 'application/pdf' });
                await uploadTask; // Wait for upload to complete
                dataToSave['Carta de presentacion'] = await uploadTask.snapshot.ref.getDownloadURL();
            } else {
                dataToSave['Carta de presentacion'] = Carta || null;
            }

            await db.collection('publishers').add(dataToSave);
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: (error as Error).message });
            throw error; // Re-throw to be caught in the component
        }
    };

    const handleUpdatePublisher = async (publisher: Publisher) => {
        try {
            const { id, Foto, ['Carta de presentacion']: Carta, ...rest } = publisher;
            const dataToUpdate: any = { ...rest };

            if (typeof Foto === 'string' && Foto.startsWith('data:')) {
                const storageRef = storage.ref(`publisher_photos/${Date.now()}_photo.webp`);
                const uploadTask = storageRef.putString(Foto, 'data_url', { contentType: 'image/webp' });
                await uploadTask; // Wait for upload to complete
                dataToUpdate.Foto = await uploadTask.snapshot.ref.getDownloadURL();
            } else {
                dataToUpdate.Foto = Foto || null;
            }

            if (Carta instanceof File) {
                const uniqueFileName = `${Date.now()}_letter.pdf`;
                const storageRef = storage.ref(`publisher_letters/${uniqueFileName}`);
                const uploadTask = storageRef.put(Carta, { contentType: 'application/pdf' });
                await uploadTask; // Wait for upload to complete
                dataToUpdate['Carta de presentacion'] = await uploadTask.snapshot.ref.getDownloadURL();
            } else {
                dataToUpdate['Carta de presentacion'] = Carta || null;
            }

            await db.collection('publishers').doc(id).update(dataToUpdate);
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: (error as Error).message });
            throw error; // Re-throw to be caught in the component
        }
    };

    const handleDeletePublisher = async (id: string) => {
        await db.collection('publishers').doc(id).delete();
    };

    const handleSaveServiceReport = async (report: Omit<ServiceReport, 'id'>) => {
        const query = await db.collection('service_reports')
            .where('idPublicador', '==', report.idPublicador)
            .where('anioCalendario', '==', report.anioCalendario)
            .where('mes', '==', report.mes)
            .get();

        if (query.empty) {
            await db.collection('service_reports').add(report);
        } else {
            await db.collection('service_reports').doc(query.docs[0].id).update(report);
        }
    };

    const handleBatchUpdateServiceReports = async (reports: Omit<ServiceReport, 'id'>[]) => {
        const batch = db.batch();
        for (const report of reports) {
            const query = await db.collection('service_reports')
                .where('idPublicador', '==', report.idPublicador)
                .where('anioCalendario', '==', report.anioCalendario)
                .where('mes', '==', report.mes)
                .limit(1)
                .get();

            if (query.empty) {
                const newDocRef = db.collection('service_reports').doc();
                batch.set(newDocRef, report);
            } else {
                const docRef = db.collection('service_reports').doc(query.docs[0].id);
                batch.update(docRef, report);
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
         const query = await db.collection('territory_records')
            .where('terrNum', '==', record.terrNum)
            .where('vueltaNum', '==', record.vueltaNum)
            .where('serviceYear', '==', record.serviceYear)
            .get();

        if (query.empty) {
            await db.collection('territory_records').add(record);
        } else {
            await db.collection('territory_records').doc(query.docs[0].id).update(record);
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
    
    const handleUploadTerritoryMap = async (territoryId: string, imageDataUrl: string) => {
        const fileName = `${territoryId}_${Date.now()}.webp`;
        const storageRef = storage.ref(`territory_maps/${fileName}`);
        const uploadTask = storageRef.putString(imageDataUrl, 'data_url', { contentType: 'image/webp' });
    
        await uploadTask; // Wait for completion
        const mapUrl = await uploadTask.snapshot.ref.getDownloadURL();
        
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
     const handleUpdatePublicReportFormEnabled = (isEnabled: boolean) => {
        return db.collection('settings').doc('config').set({ isPublicReportFormEnabled: isEnabled }, { merge: true });
    };
    const handleSaveMeetingConfig = (config: MeetingConfig) => {
        return db.collection('settings').doc('meeting_config').set(config, { merge: true });
    };
    const handleResetData = async () => {
        if (user?.role !== 'admin') {
            setModalInfo({type: 'error', title: 'Permiso Denegado', message: 'Solo los administradores pueden realizar esta acción.'});
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
        setModalInfo({type: 'info', title: 'Procesando', message: 'Eliminando todos los datos...'});
        
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
    
    const handleAddInvitation = async (imageDataUrl: string, phrase: string) => {
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
        const storageRef = storage.ref(`invitation_images/${uniqueFileName}`);
        const uploadTask = storageRef.putString(imageDataUrl, 'data_url', { contentType: 'image/webp' });
        
        await uploadTask;
        const imageUrl = await uploadTask.snapshot.ref.getDownloadURL();
        await db.collection('invitation_content').add({ imageUrl, phrase, fileName: uniqueFileName });
    };
    const handleDeleteInvitation = (contentId: string) => db.collection('invitation_content').doc(contentId).delete();

    const handleAddHomepageContent = async (imageDataUrl: string, title: string, phrase: string) => {
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
        const storageRef = storage.ref(`homepage_images/${uniqueFileName}`);
        const uploadTask = storageRef.putString(imageDataUrl, 'data_url', { contentType: 'image/webp' });
        
        await uploadTask;
        const imageUrl = await uploadTask.snapshot.ref.getDownloadURL();
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
    const handleSaveLMSchedule = (schedule: Omit<LMMeetingSchedule, 'id'> & { month: string; year: number }) => {
        const docId = `${schedule.year}-${schedule.month}`;
        return db.collection('lm_schedules').doc(docId).set(schedule, { merge: true });
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

    const ALL_COMPONENTS: { [key in View]: React.ReactElement } = {
        home: <HomeDashboard
                lmSchedules={lmSchedules}
                schedules={schedules}
                publicTalksSchedule={publicTalksSchedule}
                publishers={publishers}
                onShowModal={setModalInfo}
                setActiveView={setActiveView}
                meetingConfig={meetingConfig!}
              />,
        asistenciaForm: <AsistenciaForm attendanceRecords={attendanceRecords} onSave={handleSaveAttendance} />,
        asistenciaReporte: <AsistenciaReporte attendanceRecords={attendanceRecords} onBatchUpdateAttendance={handleBatchUpdateAttendance} canEdit={userPermissions.includes('editAsistenciaReporte')} />,
        publicadores: <Publicadores publishers={publishers} onAdd={handleAddPublisher} onUpdate={handleUpdatePublisher} onDelete={handleDeletePublisher} onShowModal={setModalInfo} canManage={userPermissions.includes('managePublicadores')} />,
        registrosServicio: <RegistrosServicio publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} onDeleteServiceReport={handleDeleteServiceReport} canEdit={userPermissions.includes('editRegistrosServicio')} />,
        grupos: <Grupos publishers={publishers} onUpdateGroup={handleUpdateGroup} canManage={userPermissions.includes('manageGrupos')} />,
        informeServicio: <InformeServicio publishers={publishers} serviceReports={serviceReports} onSaveReport={handleSaveServiceReport} onApplyForPioneer={() => setActiveView('precursorAuxiliar')} invitationContent={invitationContent} />,
        territorios: <Territorios records={territoryRecords} onSave={handleSaveTerritoryRecord} onDelete={handleDeleteTerritoryRecord} territoryMaps={territoryMaps} onUploadMap={handleUploadTerritoryMap} onDeleteMap={handleDeleteTerritoryMap} canManage={canManage} onShowModal={setModalInfo} />,
        precursorAuxiliar: <PrecursorAuxiliar userRole={user?.role || 'publisher'} isCommitteeMember={user?.isCommitteeMember || false} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} />,
        controlAcceso: <ControlAcceso users={users} publishers={publishers} committeeMembers={committeeMembers} onUpdateUserPermissions={handleUpdateUserPermissions} onUpdateServiceCommittee={handleUpdateServiceCommittee} onLinkUserToPublisher={handleLinkUserToPublisher} isPublicReportFormEnabled={appConfig?.isPublicReportFormEnabled || false} onUpdatePublicReportFormEnabled={handleUpdatePublicReportFormEnabled} onResetData={handleResetData} currentUserRole={user?.role || 'publisher'} canManage={canManage} meetingConfig={meetingConfig} onSaveMeetingConfig={handleSaveMeetingConfig} />,
        informeMensualGrupo: <InformeMensualGrupo publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} />,
        gestionContenidoInvitacion: <GestionContenidoInvitacion onShowModal={setModalInfo} invitationContent={invitationContent} onAddInvitation={handleAddInvitation} onDeleteInvitation={handleDeleteInvitation} homepageContent={homepageContent} onAddHomepageContent={handleAddHomepageContent} onDeleteHomepageContent={handleDeleteHomepageContent} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} onUpdate15HourOption={handleUpdate15HourOption} />,
        informeMensualConsolidado: <InformeMensualConsolidado publishers={publishers} serviceReports={serviceReports} />,
        dashboardCursos: <DashboardCursos publishers={publishers} serviceReports={serviceReports} />,
        dashboardPrecursores: <DashboardPrecursores publishers={publishers} serviceReports={serviceReports} pioneerApplications={pioneerApplications} />,
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
        reunionPublica: <ReunionPublica schedule={publicTalksSchedule} onSave={handleSavePublicTalksSchedule} canManage={userPermissions.includes('managePublicTalks')} publishers={publishers} onShowModal={setModalInfo} />,
        vigilancia: <Vigilancia schedules={vigilanciaSchedules} onSave={handleSaveVigilanciaSchedule} />,
    };

    // FIX: Define NAV_ITEMS to resolve 'Cannot find name' error and get the label for the header.
    const NAV_ITEMS: { view: View; label: string }[] = [
        { view: 'home', label: 'Inicio' },
        { view: 'informeServicio', label: 'Informar Servicio' },
        { view: 'precursorAuxiliar', label: 'Prec. Auxiliar' },
        { view: 'vidaYMinisterio', label: 'Prog. Vida y Ministerio' },
        { view: 'asignacionesReunion', label: 'Generar Prog. Acomodadores' },
        { view: 'reunionPublica', label: 'Reunión Pública' },
        { view: 'programaServiciosAuxiliares', label: 'Prog Acomodadores' },
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
        { view: 'controlAcceso', label: 'Control de Acceso' },
        { view: 'registroTransaccion', label: 'Registro Transacción' },
    ];

    const activeViewLabel = useMemo(() => {
        const navItem = NAV_ITEMS.find(item => item.view === activeView);
        return navItem ? navItem.label : 'Inicio';
    }, [activeView]);

    const linkedPublisher = useMemo(() => {
        if (!user || !publishers.length) return null;
        return publishers.find(p => p.authUid === user.id);
    }, [user, publishers]);

    const userCanAccessView = useMemo(() => {
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
    }, [activeView, userPermissions]);

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div></div>;
    }

    if (!user) {
        const PUBLIC_NAV_ITEMS: { view: string; label: string }[] = [
            { view: 'home', label: 'Inicio' },
            { view: 'vidaYMinisterio', label: 'Prog. Vida y Ministerio' },
            { view: 'reunionPublica', label: 'Reunión Pública' },
            { view: 'programaServiciosAuxiliares', label: 'Prog Acomodadores' },
            { view: 'dashboardCursos', label: 'Dashboard Cursos' },
            { view: 'territorios', label: 'Territorios' },
            { view: 'informeServicio', label: 'Informar Servicio' },
        ];
        
        const PublicHome = ({ homepageContent }: { homepageContent: HomepageContent[] }) => {
            if (homepageContent.length > 0) {
                return <Carousel slides={homepageContent} />;
            }
            return (
                 <div className="text-center p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
                     <h2 className="text-2xl sm:text-3xl font-bold text-blue-800">Congregacion Cerro de la Silla-Guadalupe, Bienvenido</h2>
                     <p className="mt-4 text-md sm:text-lg text-gray-600">Aquí puede ver los programas de las reuniones, consultar territorios y más.</p>
                     <p className="mt-2 text-gray-500">Para acceder a todas las funciones, por favor inicie sesión.</p>
                </div>
            );
        };

        let publicContent;
        switch(publicView) {
            case 'vidaYMinisterio':
                publicContent = <VidaYMinisterio publishers={publishers} lmSchedules={lmSchedules.filter(s => s.isPublic)} onSaveSchedule={async () => {}} onUpdatePublisherVyMAssignments={async () => {}} onShowModal={setModalInfo} canConfig={false} />;
                break;
            case 'asignacionesReunion':
                publicContent = <AsignacionesReunion publishers={publishers} schedules={schedules.filter(s => s.isPublic)} onSaveSchedule={async () => {}} onShowModal={setModalInfo} canManageSchedule={false} meetingConfig={meetingConfig!} />;
                break;
            case 'reunionPublica':
                publicContent = <ReunionPublica schedule={publicTalksSchedule} onSave={async () => {}} canManage={false} publishers={publishers} onShowModal={setModalInfo} />;
                break;
            case 'programaServiciosAuxiliares':
                publicContent = <ProgramaServiciosAuxiliares schedules={schedules.filter(s => s.isPublic)} publishers={publishers} onShowModal={setModalInfo} meetingConfig={meetingConfig!} />;
                break;
            case 'dashboardCursos':
                publicContent = <DashboardCursos publishers={publishers} serviceReports={serviceReports} />;
                break;
            case 'territorios':
                publicContent = <Territorios records={territoryRecords} onSave={async () => {}} onDelete={async () => {}} territoryMaps={territoryMaps} onUploadMap={async () => {}} onDeleteMap={async () => {}} canManage={false} onShowModal={setModalInfo} />;
                break;
            case 'informeServicio':
                publicContent = <InformeServicio publishers={publishers} serviceReports={serviceReports} onSaveReport={handleSaveServiceReport} onApplyForPioneer={() => {}} invitationContent={invitationContent} isPublicForm={true} />;
                break;
            case 'home':
            default:
                publicContent = <PublicHome homepageContent={homepageContent} />;
        }

        return (
            <div className="h-screen bg-gray-100 flex flex-col">
                <header className="bg-white shadow-md p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-blue-800">Congregación Cerro de la Silla</h1>
                    <button onClick={() => setIsLoginModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                        Iniciar Sesión
                    </button>
                </header>
                <nav className="bg-white border-b overflow-x-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex space-x-4">
                            {PUBLIC_NAV_ITEMS.map(item => (
                                <button
                                    key={item.view}
                                    onClick={() => setPublicView(item.view)}
                                    className={`py-3 px-3 text-sm font-medium whitespace-nowrap ${
                                        publicView === item.view
                                            ? 'border-b-2 border-blue-500 text-blue-600'
                                            : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </nav>
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {publicContent}
                </main>
                {isLoginModalOpen && <Login onClose={() => setIsLoginModalOpen(false)} />}
                {modalInfo && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={() => setModalInfo(null)}>
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className={`p-6 text-center border-t-8 rounded-lg ${
                                modalInfo.type === 'success' ? 'border-green-500' :
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
        photoURL: linkedPublisher?.Foto || 'https://i.imgur.com/83itvIu.png'
    };


    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleLogout} userRole={user.role} userPermissions={userPermissions} isCommitteeMember={user.isCommitteeMember} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
                {connectionError && (
                    <div className="bg-red-600 text-white text-center p-2 text-sm animate-pulse z-10">
                        {connectionError}
                    </div>
                )}
                <Header user={userProfileForHeader} activeViewLabel={activeViewLabel} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6">
                    {userCanAccessView ? ALL_COMPONENTS[activeView] : <div className="text-center p-8 bg-white rounded-lg shadow-md"><h2 className="text-2xl font-bold text-red-600">Acceso Denegado</h2><p className="mt-2">No tiene permiso para ver esta sección.</p></div>}
                </main>
            </div>

            {modalInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={() => setModalInfo(null)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className={`p-6 text-center border-t-8 rounded-lg ${
                            modalInfo.type === 'success' ? 'border-green-500' :
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
};

export default App;
