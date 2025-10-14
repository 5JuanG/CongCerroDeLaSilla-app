




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

declare const db: any;
declare const auth: any;
declare const firebase: any;
declare const storage: any;

export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const SERVICE_YEAR_MONTHS = [...MONTHS.slice(8), ...MONTHS.slice(0, 8)];

export type UserRole = 'admin' | 'overseer' | 'publisher' | 'helper' | 'auxiliary' | 'secretario';
export type View = 'asistenciaForm' | 'asistenciaReporte' | 'publicadores' | 'registrosServicio' | 'grupos' | 'informeServicio' | 'territorios' | 'precursorAuxiliar' | 'home' | 'controlAcceso' | 'informeMensualGrupo' | 'gestionContenidoInvitacion' | 'informeMensualConsolidado' | 'dashboardCursos' | 'dashboardPrecursores' | 'asignacionesReunion' | 'programaServiciosAuxiliares' | 'vidaYMinisterio' | 'registroTransaccion' | 'reunionPublica';

export type GranularPermission = 
    'editAsistenciaReporte' |
    'managePublicadores' |
    'editRegistrosServicio' |
    'manageGrupos' |
    'configVidaYMinisterio' |
    'configAsignacionesReunion' |
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
    'programaServiciosAuxiliares', 'vidaYMinisterio', 'registroTransaccion', 'reunionPublica',
    // Granular Permissions
    'editAsistenciaReporte', 'managePublicadores', 'editRegistrosServicio', 'manageGrupos',
    'configVidaYMinisterio', 'configAsignacionesReunion', 'managePublicTalks', 'resetData'
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

export interface PublicTalksSchedule {
    [talkNumber: string]: (PublicTalkAssignment | null)[];
}
export interface PublicTalkAssignment {
    date: string;
    speakerName: string;
    song: string;
    congregation?: string;
    phone?: string;
}

export interface ModalInfo {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

export const compressImage = (file: File, targetWidth: number = 1024): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target?.result as string;
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
                ctx.canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/webp',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('La compresión de la imagen falló.'));
                    }
                }, 'image/webp', 0.85);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};

const App: React.FC = () => {
    const [user, setUser] = useState<UserData | null>(null);
    const [appConfig, setAppConfig] = useState<{ is15HourOptionEnabled: boolean; isPublicReportFormEnabled: boolean; } | null>(null);
    const [initialization, setInitialization] = useState({ authChecked: false, configLoaded: false });
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>('home');
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [territoryRecords, setTerritoryRecords] = useState<TerritoryRecord[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [committeeMembers, setCommitteeMembers] = useState<string[]>([]);
    const [invitationContent, setInvitationContent] = useState<InvitationContent[]>([]);
    const [homepageContent, setHomepageContent] = useState<HomepageContent[]>([]);
    const [schedules, setSchedules] = useState<MeetingAssignmentSchedule[]>([]);
    const [lmSchedules, setLmSchedules] = useState<LMMeetingSchedule[]>([]);
    const [pioneerApplications, setPioneerApplications] = useState<PioneerApplication[]>([]);
    const [publicTalksSchedule, setPublicTalksSchedule] = useState<PublicTalksSchedule>({});
    const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);
    
    // Derived loading state
    const loading = !initialization.authChecked || !initialization.configLoaded;
    
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

    // Master initialization effect for auth and global config.
    useEffect(() => {
        let isMounted = true;

        const authUnsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
            if (!isMounted) return;
            if (firebaseUser) {
                try {
                    // ATOMIC USER HYDRATION: Wait for all user-related data before setting the user state.
                    const [userDoc, committeeDoc] = await Promise.all([
                        db.collection('users').doc(firebaseUser.uid).get(),
                        db.collection('settings').doc('service_committee').get()
                    ]);

                    const userData = userDoc.data() || {};
                    const committeeUIDs = committeeDoc.data()?.members || [];
                    const isMember = committeeUIDs.includes(firebaseUser.uid);

                    // Construct the complete user object only after all data is fetched.
                    const currentUser: UserData = {
                        id: firebaseUser.uid,
                        email: firebaseUser.email,
                        role: userData.role || 'publisher',
                        permissions: userData.permissions || [],
                        isCommitteeMember: isMember,
                        authUid: firebaseUser.uid,
                    };
                    // Set the user state once with the complete, correct data.
                    setUser(currentUser);
                    setIsLoginModalOpen(false);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setModalInfo({ type: 'error', title: 'Error de Autenticación', message: 'No se pudieron cargar los datos de su perfil. Intente de nuevo.' });
                    auth.signOut(); // Log out the user if their data can't be loaded.
                    setUser(null); // Ensure user state is cleared on error.
                }
            } else {
                // User is logged out.
                setUser(null);
            }
            // Mark auth check as complete regardless of outcome.
            setInitialization(prev => ({ ...prev, authChecked: true }));
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
            // Default to false if config can't be loaded (e.g., permissions issue for logged-out users)
            setAppConfig({ is15HourOptionEnabled: false, isPublicReportFormEnabled: false });
            setInitialization(prev => ({ ...prev, configLoaded: true }));
        });

        return () => {
            isMounted = false;
            authUnsubscribe();
            configUnsubscribe();
        };
    }, []);

    // Effect for fetching user-specific data when user logs in, and cleaning up on logout
    useEffect(() => {
        if (loading) return; // Wait for initial auth/config load

        if (!user) {
            // Clear all user-specific data states on logout
            setPublishers([]);
            setServiceReports([]);
            setAttendanceRecords([]);
            setTerritoryRecords([]);
            setUsers([]);
            setCommitteeMembers([]);
            setInvitationContent([]);
            setHomepageContent([]);
            setSchedules([]);
            setLmSchedules([]);
            setPioneerApplications([]);
            setPublicTalksSchedule({});
            return;
        }

        const unsubscribers = [
            db.collection('publishers').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setPublishers(data);
            }, (err: Error) => console.error("Publishers listener failed:", err)),

            db.collection('service_reports').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setServiceReports(data);
            }, (err: Error) => console.error("Service Reports listener failed:", err)),

            db.collection('attendance').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setAttendanceRecords(data);
            }, (err: Error) => console.error("Attendance listener failed:", err)),
            
            db.collection('territory_records').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setTerritoryRecords(data);
            }, (err: Error) => console.error("Territory listener failed:", err)),
            
            db.collection('users').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setUsers(data);
            }, (err: Error) => console.error("Users listener failed:", err)),
            
            db.collection('settings').doc('service_committee').onSnapshot((doc: any) => {
                setCommitteeMembers(doc.data()?.members || []);
            }, (err: Error) => console.error("Committee listener failed:", err)),

            db.collection('invitation_content').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setInvitationContent(data);
            }, (err: Error) => console.error("Invitation Content listener failed:", err)),

            db.collection('homepage_content').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setHomepageContent(data);
            }, (err: Error) => console.error("Homepage Content listener failed:", err)),

            db.collection('meeting_schedules').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setSchedules(data);
            }, (err: Error) => console.error("Meeting Schedules listener failed:", err)),

            db.collection('lm_schedules').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setLmSchedules(data);
            }, (err: Error) => console.error("LM Schedules listener failed:", err)),

            db.collection('pioneer_applications').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setPioneerApplications(data);
            }, (err: Error) => console.error("Pioneer Applications listener failed:", err)),
            
            db.collection('public_talks_schedule').doc('schedule').onSnapshot((doc: any) => {
                setPublicTalksSchedule(doc.data() || {});
            }, (err: Error) => console.error("Public Talks listener failed:", err)),
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
        await db.collection('attendance').doc(docId).set({ ano: year, mes: month, ...data }, { merge: true });
    };

    const handleBatchUpdateAttendance = async (records: AttendanceRecord[]) => {
        const batch = db.batch();
        records.forEach(record => {
            const { id, ...data } = record;
            const docRef = db.collection('attendance').doc(id);
            batch.set(docRef, data, { merge: true });
        });
        await batch.commit();
    };
    
    const handleAddPublisher = async (publisher: Omit<Publisher, 'id'>, onProgress?: (p: number) => void) => {
        try {
            const { Foto, ['Carta de presentacion']: Carta, ...rest } = publisher;
            let fotoUrl = null;
            let cartaUrl = null;

            if (Foto instanceof File) {
                const storageRef = storage.ref(`publisher_photos/${Date.now()}_${Foto.name}`);
                const uploadTask = storageRef.put(Foto);
                
                uploadTask.on('state_changed', 
                    (snapshot: any) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgress) onProgress(progress * 0.5); // 50% for photo
                    },
                    (error: any) => { throw error; },
                    async () => {
                        fotoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                        if (Carta instanceof File) {
                           // Continue with letter upload
                        } else {
                           await db.collection('publishers').add({ ...rest, Foto: fotoUrl });
                        }
                    }
                );
            }
            if (Carta instanceof File) {
                const letterStorageRef = storage.ref(`publisher_letters/${Date.now()}_${Carta.name}`);
                const letterUploadTask = letterStorageRef.put(Carta);
                letterUploadTask.on('state_changed',
                    (snapshot: any) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                         if (onProgress) onProgress(50 + (progress * 0.5)); // 50% for letter
                    },
                    (error: any) => { throw error; },
                    async () => {
                        cartaUrl = await letterUploadTask.snapshot.ref.getDownloadURL();
                        await db.collection('publishers').add({ ...rest, Foto: fotoUrl, 'Carta de presentacion': cartaUrl });
                    }
                );
            }
             if (!(Foto instanceof File) && !(Carta instanceof File)) {
                await db.collection('publishers').add(publisher);
            }
        } catch (error) {
            setModalInfo({ type: 'error', title: 'Error', message: (error as Error).message });
            throw error;
        }
    };
    
    const handleUpdatePublisher = async (publisher: Publisher, onProgress?: (p: number) => void) => {
        try {
            const { id, Foto, ['Carta de presentacion']: Carta, ...rest } = publisher;
            let dataToUpdate: any = { ...rest };
            
            if (Foto instanceof File) {
                const storageRef = storage.ref(`publisher_photos/${Date.now()}_${Foto.name}`);
                const uploadTask = storageRef.put(Foto);
                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed', (snapshot: any) => {
                        if (onProgress) onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 50);
                    }, reject, async () => {
                        dataToUpdate.Foto = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve();
                    });
                });
            } else {
                 dataToUpdate.Foto = Foto;
            }

            if (Carta instanceof File) {
                 const storageRef = storage.ref(`publisher_letters/${Date.now()}_${Carta.name}`);
                const uploadTask = storageRef.put(Carta);
                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed', (snapshot: any) => {
                        if (onProgress) onProgress(50 + ((snapshot.bytesTransferred / snapshot.totalBytes) * 50));
                    }, reject, async () => {
                        dataToUpdate['Carta de presentacion'] = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve();
                    });
                });
            } else {
                 dataToUpdate['Carta de presentacion'] = Carta;
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
    const handleResetData = async () => {
        if (user?.role !== 'admin') {
            setModalInfo({type: 'error', title: 'Permiso Denegado', message: 'Solo los administradores pueden realizar esta acción.'});
            return;
        }
        if (!window.confirm("¡ADVERTENCIA! ¿Está absolutamente seguro de que desea borrar TODOS los datos de la congregación? Esta acción es irreversible y eliminará informes, publicadores, asignaciones, etc.")) {
            return;
        }
         if (!window.confirm("CONFIRMACIÓN FINAL: ¿Está 100% seguro? Todos los datos se perderán para siempre.")) {
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
    
    const handleAddInvitation = async (imageFile: File, phrase: string, onProgress?: (progress: number) => void) => {
        const storageRef = storage.ref(`invitation_images/${Date.now()}_${imageFile.name}`);
        const uploadTask = storageRef.put(imageFile);
        
        await new Promise<void>((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot: any) => {
                    if (onProgress) onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                },
                (error: any) => reject(error),
                async () => {
                    const imageUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    await db.collection('invitation_content').add({ imageUrl, phrase });
                    resolve();
                }
            );
        });
    };
    const handleDeleteInvitation = (contentId: string) => db.collection('invitation_content').doc(contentId).delete();

    const handleAddHomepageContent = async (imageFile: File, title: string, phrase: string, onProgress?: (progress: number) => void) => {
        const storageRef = storage.ref(`homepage_images/${Date.now()}_${imageFile.name}`);
        const uploadTask = storageRef.put(imageFile);
        
        await new Promise<void>((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot: any) => {
                    if (onProgress) onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                },
                (error: any) => reject(error),
                async () => {
                    const imageUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    await db.collection('homepage_content').add({ imageUrl, title, phrase });
                    resolve();
                }
            );
        });
    };
    const handleDeleteHomepageContent = (contentId: string) => db.collection('homepage_content').doc(contentId).delete();

    const handleUpdate15HourOption = (isEnabled: boolean) => {
        return db.collection('settings').doc('config').set({ is15HourOptionEnabled: isEnabled }, { merge: true });
    };

    const handleSaveMeetingSchedule = async (schedule: Omit<MeetingAssignmentSchedule, 'id'>) => {
        const docId = `${schedule.year}-${schedule.month}`;
        await db.collection('meeting_schedules').doc(docId).set(schedule, { merge: true });
    };
    const handleUpdatePublisherAssignments = async (publisherId: string, assignments: string[]) => {
        await db.collection('publishers').doc(publisherId).update({ asignacionesDisponibles: assignments });
    };
    const handleSaveLMSchedule = (schedule: Omit<LMMeetingSchedule, 'id'>) => {
        const docId = `${schedule.year}-${schedule.month}`;
        return db.collection('lm_schedules').doc(docId).set(schedule, { merge: true });
    };
    const handleUpdatePublisherVyMAssignments = (publisherId: string, assignments: { [key: string]: boolean }) => {
        return db.collection('publishers').doc(publisherId).update(assignments);
    };
    const handleSavePublicTalksSchedule = async (schedule: PublicTalksSchedule) => {
        await db.collection('public_talks_schedule').doc('schedule').set(schedule, { merge: true });
    };

    const ALL_COMPONENTS: { [key in View]: React.ReactElement } = {
        home: <div className="text-center p-8"><h1 className="text-4xl font-bold">Bienvenido al Centro de Actividades v2.0</h1><p className="mt-4 text-lg">Seleccione una opción del menú para comenzar.</p></div>,
        asistenciaForm: <AsistenciaForm attendanceRecords={attendanceRecords} onSave={handleSaveAttendance} />,
        asistenciaReporte: <AsistenciaReporte attendanceRecords={attendanceRecords} onBatchUpdateAttendance={handleBatchUpdateAttendance} canEdit={userPermissions.includes('editAsistenciaReporte')} />,
        publicadores: <Publicadores publishers={publishers} onAdd={handleAddPublisher} onUpdate={handleUpdatePublisher} onDelete={handleDeletePublisher} onShowModal={setModalInfo} canManage={userPermissions.includes('managePublicadores')} />,
        registrosServicio: <RegistrosServicio publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} onDeleteServiceReport={handleDeleteServiceReport} canEdit={userPermissions.includes('editRegistrosServicio')} />,
        grupos: <Grupos publishers={publishers} onUpdateGroup={handleUpdateGroup} canManage={userPermissions.includes('manageGrupos')} />,
        informeServicio: <InformeServicio publishers={publishers} serviceReports={serviceReports} onSaveReport={handleSaveServiceReport} onApplyForPioneer={() => setActiveView('precursorAuxiliar')} invitationContent={invitationContent} />,
        territorios: <Territorios records={territoryRecords} onSave={handleSaveTerritoryRecord} onDelete={handleDeleteTerritoryRecord} />,
        precursorAuxiliar: <PrecursorAuxiliar userRole={user?.role || 'publisher'} isCommitteeMember={user?.isCommitteeMember || false} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} />,
        controlAcceso: <ControlAcceso users={users} publishers={publishers} committeeMembers={committeeMembers} onUpdateUserPermissions={handleUpdateUserPermissions} onUpdateServiceCommittee={handleUpdateServiceCommittee} onLinkUserToPublisher={handleLinkUserToPublisher} isPublicReportFormEnabled={appConfig?.isPublicReportFormEnabled || false} onUpdatePublicReportFormEnabled={handleUpdatePublicReportFormEnabled} onResetData={handleResetData} currentUserRole={user?.role || 'publisher'} canManage={canManage} />,
        informeMensualGrupo: <InformeMensualGrupo publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} />,
        gestionContenidoInvitacion: <GestionContenidoInvitacion invitationContent={invitationContent} onAddInvitation={handleAddInvitation} onDeleteInvitation={handleDeleteInvitation} homepageContent={homepageContent} onAddHomepageContent={handleAddHomepageContent} onDeleteHomepageContent={handleDeleteHomepageContent} is15HourOptionEnabled={appConfig?.is15HourOptionEnabled || false} onUpdate15HourOption={handleUpdate15HourOption} />,
        informeMensualConsolidado: <InformeMensualConsolidado publishers={publishers} serviceReports={serviceReports} />,
        dashboardCursos: <DashboardCursos publishers={publishers} serviceReports={serviceReports} />,
        dashboardPrecursores: <DashboardPrecursores publishers={publishers} serviceReports={serviceReports} pioneerApplications={pioneerApplications} />,
        asignacionesReunion: <AsignacionesReunion publishers={publishers} schedules={schedules} onSaveSchedule={handleSaveMeetingSchedule} onUpdatePublisherAssignments={handleUpdatePublisherAssignments} onShowModal={setModalInfo} canConfig={userPermissions.includes('configAsignacionesReunion')} />,
        programaServiciosAuxiliares: <ProgramaServiciosAuxiliares schedules={schedules} publishers={publishers} onShowModal={setModalInfo} />,
        vidaYMinisterio: <VidaYMinisterio publishers={publishers} lmSchedules={lmSchedules} onSaveSchedule={handleSaveLMSchedule} onUpdatePublisherVyMAssignments={handleUpdatePublisherVyMAssignments} onShowModal={setModalInfo} canConfig={userPermissions.includes('configVidaYMinisterio')} />,
        registroTransaccion: <RegistroTransaccion />,
        reunionPublica: <ReunionPublica schedule={publicTalksSchedule} onSave={handleSavePublicTalksSchedule} canManage={userPermissions.includes('managePublicTalks')} />,
    };

    // FIX: Define NAV_ITEMS to resolve 'Cannot find name' error and get the label for the header.
    const NAV_ITEMS: { view: View; label: string }[] = [
        { view: 'home', label: 'Inicio' },
        { view: 'informeServicio', label: 'Informar Servicio' },
        { view: 'precursorAuxiliar', label: 'Prec. Auxiliar' },
        { view: 'vidaYMinisterio', label: 'Vida y Ministerio' },
        { view: 'asignacionesReunion', label: 'Asignaciones Reunión' },
        { view: 'reunionPublica', label: 'Reunión Pública' },
        { view: 'programaServiciosAuxiliares', label: 'Programa Serv. Aux.' },
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

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div></div>;
    }

    if (!user) {
        return (
            <div className="h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
                 <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-blue-800">Congregación Cerro de la Silla</h1>
                    <p className="text-xl text-gray-600">Portal de Actividades</p>
                </div>
                 {appConfig?.isPublicReportFormEnabled ? (
                    <div className="w-full max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="bg-white p-6 rounded-lg shadow-md">
                                <h2 className="text-2xl font-bold text-center mb-4">Informar Servicio</h2>
                                <InformeServicio publishers={[]} serviceReports={[]} onSaveReport={handleSaveServiceReport} onApplyForPioneer={() => {}} invitationContent={[]} isPublicForm={true} />
                            </div>
                             <div className="bg-white p-6 rounded-lg shadow-md">
                                 <h2 className="text-2xl font-bold text-center mb-4">Solicitar Precursorado</h2>
                                 <PrecursorAuxiliar userRole="publisher" isCommitteeMember={false} forceFormView={true} is15HourOptionEnabled={appConfig.is15HourOptionEnabled}/>
                            </div>
                        </div>
                         <p className="text-center mt-8 text-gray-600">¿Eres un usuario registrado? <button onClick={() => setIsLoginModalOpen(true)} className="text-blue-600 hover:underline font-semibold">Inicia sesión aquí</button>.</p>
                         {isLoginModalOpen && <Login onClose={() => setIsLoginModalOpen(false)} />}
                    </div>
                ) : (
                     <Login onClose={() => { /* This won't be called, but the component expects it */ }} />
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
            <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleLogout} userRole={user.role} userPermissions={userPermissions} isCommitteeMember={user.isCommitteeMember}/>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6">
                     <Header user={userProfileForHeader} activeViewLabel={activeViewLabel} />
                     <div className="mt-6">
                        {userPermissions.includes(activeView) ? ALL_COMPONENTS[activeView] : <div className="text-center p-8 bg-white rounded-lg shadow-md"><h2 className="text-2xl font-bold text-red-600">Acceso Denegado</h2><p className="mt-2">No tiene permiso para ver esta sección.</p></div>}
                     </div>
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
