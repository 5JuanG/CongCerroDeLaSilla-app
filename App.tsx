
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
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

export type UserRole = 'admin' | 'overseer' | 'publisher' | 'helper' | 'auxiliary';
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

const ALL_PERMISSIONS: Permission[] = [
    'asistenciaForm', 'asistenciaReporte', 'publicadores', 'registrosServicio', 'grupos', 'informeServicio', 'territorios', 'precursorAuxiliar', 'home', 'controlAcceso', 'informeMensualGrupo', 'gestionContenidoInvitacion', 'informeMensualConsolidado', 'dashboardCursos', 'dashboardPrecursores', 'asignacionesReunion', 'programaServiciosAuxiliares', 'vidaYMinisterio', 'registroTransaccion', 'reunionPublica',
    'editAsistenciaReporte', 'managePublicadores', 'editRegistrosServicio', 'manageGrupos', 'configVidaYMinisterio', 'configAsignacionesReunion', 'managePublicTalks', 'resetData'
];


// Unified Publisher Type
export interface Publisher {
    id: string; // Firestore document ID
    authUid?: string; // Firebase Auth User ID for linking
    Nombre: string;
    Apellido: string;
    '2do Apellido'?: string;
    'Apellido de casada'?: string;
    Sexo?: 'Hombre' | 'Mujer' | '';
    'Fecha de Nacimiento'?: string;
    Calle?: string;
    Numero?: string;
    Colonia?: string;
    Municipio?: string;
    Estado?: string;
    CP?: string;
    Cel?: string;
    Correo?: string;
    'Fecha de bautismo'?: string;
    Esperanza?: 'Otras ovejas' | 'Ungido' | string;
    Privilegio?: 'Anciano' | 'Siervo Ministerial' | string;
    'Priv Adicional'?: 'Precursor Regular' | 'Precursor Especial' | 'Misionero' | string;
    Grupo?: string;
    'Contacto de Emergencia'?: string;
    'Cel de Emergencia'?: string;
    Estatus: 'Activo' | 'Inactivo' | 'Se cambió de congregación' | 'Falleció' | 'Sacado de la congregación';
    Foto?: string;
    'Carta de presentacion'?: string;
    asignacionesDisponibles?: string[];
    // Vida y Ministerio Eligibility - Granular
    vym_presidente?: boolean;
    vym_oracion?: boolean;
    vym_tesoros?: boolean;
    vym_perlas?: boolean;
    vym_conductor_ebc?: boolean;
    // Kept for now, might be refactored into the above
    puedeLeerBibliaVyM?: boolean; 
    esEstudianteVyM?: boolean; 
    puedeLeerEBC?: boolean; 
}

export interface ServiceReport {
    id: string; // Composite key: idPublicador_anioCalendario_mes
    idPublicador: string;
    mes: string;
    anioCalendario: number;
    participacion: boolean;
    precursorAuxiliar: string; // 'PA' or ''
    horas?: number;
    cursosBiblicos?: number;
    notas?: string;
    nombrePublicador?: string; // For public submissions
}

export interface AsistenciaData {
    es_sem1: string; es_sem2: string; es_sem3: string; es_sem4: string; es_sem5: string;
    fs_sem1: string; fs_sem2: string; fs_sem3: string; fs_sem4: string; fs_sem5: string;
}

export interface AttendanceRecord extends AsistenciaData {
    id: string; // Composite key: YYYY_Month
    ano: number;
    mes: string;
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

export interface PioneerApplication {
    id: string;
    nombre: string;
    mes: string;
    deContinuo: boolean;
    fecha: string;
    status: 'Pendiente' | 'Aprobado';
    horas: '15' | '30' | string;
    firma_solicitante: string | null;
    firma1: string | null;
    firma2: string | null;
    firma3: string | null;
}

export interface TerritoryRecord {
    id: string; // Composite key: serviceYear_terrNum_vueltaNum
    terrNum: number;
    vueltaNum: number;
    serviceYear: number;
    asignadoA?: string;
    assignedDate?: string;
    completedDate?: string;
    observations?: string;
}

export interface DayAssignment {
    // Common
    fechaReunion?: string; // New: Editable meeting date, e.g., "Martes 5"
    reunionHorario?: string; // New: Editable meeting time, e.g., "7:30 p. m."
    acomodadoresPrincipal?: string[]; // 1 for Tue, 1 for Sat
    acomodadoresAuditorio?: string[]; // 1 for Tue, 1 for Sat
    acomodadoresSala?: string[]; // 2 for both Tue and Sat
    microfonos?: string[]; // 2 for both
    vigilantes?: string[]; // 3 for both
    vigilanciaHorario?: string; // New: Editable vigilance time
    aseo?: string; // Group name
    // Saturday only
    presidente?: string;
    conductorAtalaya?: string;
    lectorAtalaya?: string;
    hospitalidad?: string; // Group name
}

export interface MeetingAssignmentSchedule {
    id: string; // YYYY-Month
    year: number;
    month: string;
    schedule: {
        [dateKey: string]: DayAssignment; // e.g., "tuesday-2024-08-06", "saturday-2024-08-10"
    };
}

export interface LMWeekAssignment {
    fecha: string;
    // Song Numbers
    cancion_inicial_numero?: string;
    cancion_media1_numero?: string;
    cancion_media2_numero?: string;
    cancion_final_numero?: string;
    // Participants
    presidente?: string;
    oracionInicial?: string;
    tesoros_discurso?: string;
    tesoros_perlas?: string;
    tesoros_lectura?: string;
    ministerio_parte1_participante1?: string;
    ministerio_parte1_participante2?: string;
    ministerio_parte2_participante1?: string;
    ministerio_parte2_participante2?: string;
    ministerio_parte3_participante1?: string;
    ministerio_parte3_participante2?: string;
    vida_participante1?: string;
    vida_participante2_conductor?: string;
    vida_participante2_lector?: string;
    oracionFinal?: string;
    // Titles (extracted by AI)
    tesoros_discurso_titulo?: string;
    tesoros_perlas_titulo?: string;
    tesoros_lectura_titulo?: string;
    ministerio_parte1_titulo?: string;
    ministerio_parte2_titulo?: string;
    ministerio_parte3_titulo?: string;
    vida_titulo_parte1?: string;
    vida_titulo_parte2?: string;
    // Calculated Times
    hora_cancion_inicial?: string;
    hora_introduccion?: string;
    hora_tesoros_discurso?: string;
    hora_tesoros_perlas?: string;
    hora_tesoros_lectura?: string;
    hora_cancion_media1?: string;
    hora_ministerio_parte1?: string;
    hora_ministerio_parte2?: string;
    hora_ministerio_parte3?: string;
    hora_cancion_media2?: string;
    hora_vida_parte1?: string;
    hora_estudio_biblico?: string;
    hora_conclusion?: string;
    hora_cancion_final?: string;
}


export interface LMMeetingSchedule {
    id: string; // YYYY-Month
    year: number;
    month: string;
    weeks: LMWeekAssignment[];
}

export interface PublicTalkAssignment {
    date: string;
    speakerName: string;
    song: string;
    congregation: string;
    phone: string;
}

export interface PublicTalksSchedule {
    [talkNumber: string]: (PublicTalkAssignment | null)[];
}


export interface UserData {
    id: string;
    email: string;
    role: UserRole;
    permissions?: Permission[];
}

interface AppUserState {
    uid: string;
    email: string;
    role: UserRole;
    permissions: Permission[];
    isCommitteeMember: boolean;
}

// --- Modal Types and Component ---
export type ModalInfo = {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

/**
 * Comprime una imagen en el lado del cliente antes de subirla.
 * Esta función es robusta:
 * - Valida el tipo de archivo.
 * - Redimensiona la imagen a un ancho máximo para optimizar el tamaño.
 * - Convierte la imagen a formato JPEG con una calidad del 80% para un buen balance entre calidad y tamaño.
 * - Maneja imágenes con transparencia (como PNG) añadiendo un fondo blanco.
 * - Proporciona mensajes de error claros para problemas comunes (formato no soportado, archivo dañado, etc.).
 * @param file El archivo de imagen original del input del usuario.
 * @param maxWidth El ancho máximo que tendrá la imagen. La altura se ajusta para mantener la proporción.
 * @returns Una Promise que se resuelve con el nuevo archivo de imagen (File object) comprimido.
 */
export const compressImage = (file: File, maxWidth: number = 1024): Promise<File> => {
    return new Promise((resolve, reject) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return reject(new Error(`Formato de archivo no soportado. Por favor, use JPEG, PNG, o WEBP.`));
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));

        reader.onload = event => {
            const imageUrl = event.target?.result;
            if (typeof imageUrl !== 'string') {
                return reject(new Error("Error al procesar el archivo de imagen."));
            }

            const img = new Image();
            img.src = imageUrl;

            // Esta es una validación importante para formatos como HEIC (de iPhones) que a veces no son soportados por el navegador.
            img.onerror = () => reject(new Error("No se pudo cargar la imagen. El archivo puede estar dañado o en un formato no compatible (como HEIC)."));
            
            img.onload = () => {
                let { width, height } = img;

                // Calcula las nuevas dimensiones si la imagen es más ancha que el máximo permitido.
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                // Usamos un <canvas> como un "pincel digital" para redibujar la imagen con las nuevas dimensiones.
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('No se pudo obtener el contexto del canvas.'));
                }

                // Si la imagen original era PNG con transparencia, la convertimos a JPG con fondo blanco para evitar fondos negros.
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convertimos el contenido del canvas de nuevo a un archivo (Blob) y luego a un File object.
                canvas.toBlob(
                    (blob: Blob | null) => {
                        if (blob) {
                            // Usamos el nombre del archivo original pero forzamos la extensión .jpeg para consistencia.
                            const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpeg";
                            const newFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
                            
                            const MAX_SIZE_MB = 5;
                            if (newFile.size > MAX_SIZE_MB * 1024 * 1024) {
                                return reject(new Error(`La imagen comprimida supera el límite de ${MAX_SIZE_MB}MB.`));
                            }
                            
                            console.log(`Imagen comprimida: ${(file.size / 1024).toFixed(1)}KB -> ${(newFile.size / 1024).toFixed(1)}KB`);
                            resolve(newFile);
                        } else {
                            reject(new Error('Falló la compresión de la imagen (canvas.toBlob devolvió nulo).'));
                        }
                    },
                    'image/jpeg',
                    0.80 // 80% de calidad. Un buen balance.
                );
            };
        };
    });
};


const InfoModal: React.FC<{ info: ModalInfo | null; onClose: () => void }> = ({ info, onClose }) => {
    if (!info) return null;
    const colors = {
        error: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', button: 'bg-red-600 hover:bg-red-700' },
        success: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', button: 'bg-green-600 hover:bg-green-700' },
        info: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500', button: 'bg-blue-600 hover:bg-blue-700' },
    };
    const color = colors[info.type];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]">
            <div className="bg-white rounded-lg shadow-xl m-4 max-w-md w-full animate-fade-in-up">
                <div className={`p-4 rounded-t-lg ${color.bg} border-b-4 ${color.border}`}>
                    <h3 className={`text-xl font-bold ${color.text}`}>{info.title}</h3>
                </div>
                <div className="p-6">
                    <p className="text-gray-700 whitespace-pre-wrap">{info.message}</p>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end rounded-b-lg">
                    <button onClick={onClose} className={`${color.button} text-white font-bold py-2 px-6 rounded-lg`}>
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Logged Out Components ---
const TopNavBar: React.FC<{ onLoginClick: () => void; onFormClick: (form: View) => void }> = ({ onLoginClick, onFormClick }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const handleFormClick = (form: View) => {
        onFormClick(form);
        setIsMobileMenuOpen(false);
    };

    const handleHomeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        window.location.hash = '';
        setIsMobileMenuOpen(false);
    }

    const navLinks = (
        <>
            <a href="#" onClick={handleHomeClick} className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Inicio</a>
            <button onClick={() => handleFormClick('informeServicio')} className="text-left w-full md:w-auto text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Informar Servicio</button>
            <button onClick={() => handleFormClick('precursorAuxiliar')} className="text-left w-full md:w-auto text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Prec. Auxiliar</button>
            <button onClick={onLoginClick} className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium ml-0 md:ml-4 mt-2 md:mt-0 w-full md:w-auto">Iniciar Sesión</button>
        </>
    );

    return (
        <nav className="bg-gray-800 shadow-md fixed w-full z-20 top-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-shrink-0 text-white font-bold">
                        Cong. Cerro de la Silla-GPE
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navLinks}
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                            <span className="sr-only">Abrir menú principal</span>
                            <svg className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                            <svg className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden bg-gray-800`}>
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 flex flex-col">
                    {navLinks}
                </div>
            </div>
        </nav>
    );
};

const HomePage: React.FC<{ onFormClick: (form: View) => void; homepageContent: HomepageContent[] }> = ({ onFormClick, homepageContent }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (homepageContent && homepageContent.length > 1) {
            const timer = setInterval(() => {
                setCurrentSlide(prev => (prev === homepageContent.length - 1 ? 0 : prev + 1));
            }, 7000); // Change slide every 7 seconds
            return () => clearInterval(timer);
        }
    }, [homepageContent]);

    const handleFormClick = (e: React.MouseEvent<HTMLButtonElement>, form: View) => {
        e.preventDefault();
        onFormClick(form);
    };

    const hasContent = homepageContent && homepageContent.length > 0;
    const currentItem = hasContent ? homepageContent[currentSlide] : null;

    const fallbackContent = {
        imageUrl: "url('https://images.unsplash.com/photo-1541892095823-38501b445037?q=80&w=2070&auto=format&fit=crop')",
        title: "Un mundo sin guerras y sin conflictos armados es posible",
        phrase: "El Reino de Dios acabará con las guerras y traerá verdadera paz a la Tierra."
    };
    
    return (
        <div className="h-screen">
            <div className="relative h-full bg-cover bg-center flex items-center justify-center text-white overflow-hidden">
                {hasContent ? (
                    homepageContent.map((item, index) => (
                        <div
                            key={item.id}
                            className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                            style={{ backgroundImage: `url('${item.imageUrl}')` }}
                        />
                    ))
                ) : (
                    <div
                        className="absolute inset-0 w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: fallbackContent.imageUrl }}
                    />
                )}

                <div className="absolute inset-0 bg-black opacity-50"></div>
                <div className="relative text-center p-4 z-10 animate-fade-in-up">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{currentItem ? currentItem.title : fallbackContent.title}</h1>
                    <p className="mt-4 text-lg md:text-xl max-w-3xl mx-auto">{currentItem ? currentItem.phrase : fallbackContent.phrase}</p>
                    <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-6">
                        <button onClick={(e) => handleFormClick(e, 'informeServicio')} className="text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            Informe de Servicio
                        </button>
                        <button onClick={(e) => handleFormClick(e, 'precursorAuxiliar')} className="text-lg font-semibold text-white bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                            Solicitud Prec. Auxiliar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FormModal: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-30 p-4 animate-fade-in-up" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-2 text-right border-b sticky top-0 bg-white z-10">
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl px-2">&times;</button>
                </div>
                <div className="overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * Attempts to fetch a user document from Firestore with a retry mechanism.
 * This is crucial to handle potential race conditions where Firestore security rules
 * have not yet fully processed the new authentication state immediately after login,
 * which can cause a temporary "permission denied" error.
 * @param uid The user's authentication UID.
 * @param retries The number of times to retry.
 * @param delay The base delay in milliseconds between retries.
 * @returns A promise that resolves to the user document snapshot or null if not found after all retries.
 */
const getUserDocumentWithRetry = async (uid: string, retries: number = 4, delay: number = 250): Promise<any | null> => {
    for (let i = 0; i < retries; i++) {
        try {
            const userDocRef = db.collection('users').doc(uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                return userDoc; // Success!
            }
            // If doc doesn't exist, we still retry, as it might be a transient permissions issue masking existence.
        } catch (error) {
            // If this is the last attempt, re-throw the error to be caught by the main handler.
            if (i === retries - 1) {
                console.error(`Final attempt to fetch user document failed after ${retries} retries.`, error);
                throw error;
            }
            console.warn(`Attempt ${i + 1} failed, retrying...`, error);
        }
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
    // If all retries complete without returning a document, it truly doesn't exist.
    return null;
};


const App: React.FC = () => {
    const [user, setUser] = useState<AppUserState | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeView, setActiveView] = useState<View>('home');
    const [activeFormModal, setActiveFormModal] = useState<View | null>(null);
    const [forcePrecursorForm, setForcePrecursorForm] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    
    // --- Data State ---
    const [users, setUsers] = useState<UserData[]>([]);
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [publishersLoading, setPublishersLoading] = useState(true);
    const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);
    const [invitationContent, setInvitationContent] = useState<InvitationContent[]>([]);
    const [invitationContentLoading, setInvitationContentLoading] = useState(true);
    const [homepageContent, setHomepageContent] = useState<HomepageContent[]>([]);
    const [homepageContentLoading, setHomepageContentLoading] = useState(true);
    const [territoryRecords, setTerritoryRecords] = useState<TerritoryRecord[]>([]);
    const [territoryLoading, setTerritoryLoading] = useState(true);
    const [pioneerApplications, setPioneerApplications] = useState<PioneerApplication[]>([]);
    const [pioneerApplicationsLoading, setPioneerApplicationsLoading] = useState(true);
    const [meetingAssignments, setMeetingAssignments] = useState<MeetingAssignmentSchedule[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(true);
    const [lmSchedules, setLmSchedules] = useState<LMMeetingSchedule[]>([]);
    const [lmSchedulesLoading, setLmSchedulesLoading] = useState(true);
    const [publicTalksSchedule, setPublicTalksSchedule] = useState<PublicTalksSchedule>({});
    const [publicTalksLoading, setPublicTalksLoading] = useState(true);
    const [is15HourOptionEnabled, setIs15HourOptionEnabled] = useState(true);
    const [settingsLoading, setSettingsLoading] = useState(true);
    
    const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);

    // --- Firebase Auth State Listener ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (authUser: any) => {
            if (authUser) {
                try {
                    const userDoc = await getUserDocumentWithRetry(authUser.uid);

                    if (!userDoc) { // The retry function returns null if not found
                        console.error(`CRITICAL: User document for UID ${authUser.uid} does not exist or is not readable after retries.`);
                        throw new Error("No se encontró tu perfil de usuario o no tienes permiso para leerlo. Por favor, contacta al administrador.");
                    }
                    
                    const userData = userDoc.data();
                    
                    let committeeUids: string[] = [];
                    try {
                        const committeeDoc = await db.collection('settings').doc('serviceCommittee').get();
                        if (committeeDoc.exists) {
                            committeeUids = committeeDoc.data().members || [];
                        }
                    } catch (committeeError) {
                        console.warn("Could not load service committee settings during login.", committeeError);
                    }
                    
                    setUser({
                        uid: authUser.uid,
                        email: authUser.email,
                        role: userData.role || 'publisher',
                        permissions: userData.role === 'admin' ? ALL_PERMISSIONS : (userData.permissions || []),
                        isCommitteeMember: committeeUids.includes(authUser.uid),
                    });
                    
                    setIsLoginModalOpen(false);
                    setActiveFormModal(null);
                    
                    const role = userData.role || 'publisher';
                    if (role === 'publisher') setActiveView('informeServicio');
                    else if (role === 'overseer') setActiveView('registrosServicio');
                    else setActiveView('home');

                } catch (error: any) {
                    console.error("Error processing user login:", error);
                    
                    let title = 'Error de Inicio de Sesión';
                    let errorMessage = 'Ocurrió un problema inesperado al cargar tu perfil. Intenta de nuevo más tarde.';

                    // Check for a specific Firebase/Firestore error code first
                    if (error.code) { // Firebase errors have a 'code' property
                        title = 'Error de Permisos de Base de Datos';
                        errorMessage = `El servidor de la base de datos bloqueó el acceso a tu perfil.\n\nDetalles del error:\nCódigo: ${error.code}\nMensaje: ${error.message}\n\nEste es un problema con las Reglas de Seguridad de Firestore, no con la aplicación. Por favor, contacta al administrador con esta información para que pueda corregir las reglas.`;
                    } else if (error instanceof Error) {
                        // Fallback for generic errors
                        if (error.message.includes("No se encontró tu perfil de usuario")) {
                            errorMessage = error.message;
                        }
                    }

                    setModalInfo({ type: 'error', title: title, message: errorMessage });
                    auth.signOut();
                }

            } else {
                setUser(null);
                setActiveView('home');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Firestore Users Real-time Listener (for ControlAcceso) ---
    useEffect(() => {
        if (user?.role !== 'admin') {
            setUsers([]);
            return;
        }
        const unsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const usersData = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setUsers(usersData);
        }, (error: any) => {
            console.error("Error fetching users:", error);
        });
        return () => unsubscribe();
    }, [user]);

    // --- Firestore Publishers Real-time Listener ---
    useEffect(() => {
        // This content is needed for the public service report form, so it's loaded regardless of auth state.
        setPublishersLoading(true);
        const unsubscribe = db.collection('publishers')
            .onSnapshot((snapshot: any) => {
                const publishersData: Publisher[] = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                publishersData.sort((a, b) => a.Nombre.localeCompare(b.Nombre));
                setPublishers(publishersData);
                setPublishersLoading(false);
            }, (error: any) => {
                console.error("Error fetching publishers:", error);
                setPublishersLoading(false);
                if (!auth.currentUser) {
                     setModalInfo({
                        type: 'error',
                        title: 'Error de Conexión',
                        message: 'No se pudo cargar la lista de publicadores para el formulario de informe.\n\nEsto puede deberse a un problema de conexión o a que las reglas de seguridad de la base de datos no permiten la lectura pública de esta lista. Por favor, contacte al administrador.'
                    });
                }
            });
        
        return () => unsubscribe();
    }, []);

    // --- Firestore Service Reports Real-time Listener ---
    useEffect(() => {
        if (!user) {
            setServiceReports([]);
            setReportsLoading(false);
            return;
        }
        setReportsLoading(true);
        const unsubscribe = db.collection('service_reports')
            .onSnapshot((snapshot: any) => {
                const reportsData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setServiceReports(reportsData);
                setReportsLoading(false);
            }, (error: any) => {
                console.error("Error fetching service reports:", error);
                setReportsLoading(false);
            });

        return () => unsubscribe();
    }, [user]);

    // --- Firestore Attendance Records Real-time Listener ---
    useEffect(() => {
        if (!user) {
            setAttendanceRecords([]);
            setAttendanceLoading(false);
            return;
        }
        setAttendanceLoading(true);
        const unsubscribe = db.collection('attendance_records')
            .onSnapshot((snapshot: any) => {
                const recordsData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setAttendanceRecords(recordsData);
                setAttendanceLoading(false);
            }, (error: any) => {
                console.error("Error fetching attendance records:", error);
                setAttendanceLoading(false);
            });

        return () => unsubscribe();
    }, [user]);
    
    // --- Firestore Invitation Content Real-time Listener ---
    useEffect(() => {
        // This content is public, so no user dependency is needed.
        setInvitationContentLoading(true);
        const unsubscribe = db.collection('invitation_content')
            .onSnapshot((snapshot: any) => {
                const contentData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                contentData.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setInvitationContent(contentData);
                setInvitationContentLoading(false);
            }, (error: any) => {
                console.error("Error fetching invitation content:", error);
                setInvitationContentLoading(false);
            });

        return () => unsubscribe();
    }, []);

    // --- Firestore Homepage Content Real-time Listener ---
    useEffect(() => {
        // This content is public, so no user dependency is needed.
        setHomepageContentLoading(true);
        const unsubscribe = db.collection('homepage_content')
            .onSnapshot((snapshot: any) => {
                const contentData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                contentData.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setHomepageContent(contentData);
                setHomepageContentLoading(false);
            }, (error: any) => {
                console.error("Error fetching homepage content:", error);
                setHomepageContentLoading(false);
            });
        return () => unsubscribe();
    }, []);

    // --- Firestore Territory Records Real-time Listener ---
    useEffect(() => {
        if (!user) {
            setTerritoryRecords([]);
            setTerritoryLoading(false);
            return;
        }
        setTerritoryLoading(true);
        const unsubscribe = db.collection('territory_records')
            .onSnapshot((snapshot: any) => {
                const recordsData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setTerritoryRecords(recordsData);
                setTerritoryLoading(false);
            }, (error: any) => {
                console.error("Error fetching territory records:", error);
                setTerritoryLoading(false);
            });

        return () => unsubscribe();
    }, [user]);
    
    // --- Firestore Pioneer Applications Listener ---
    useEffect(() => {
        if (!user) {
            setPioneerApplications([]);
            setPioneerApplicationsLoading(false);
            return;
        }
        setPioneerApplicationsLoading(true);
        const unsubscribe = db.collection('pioneer_applications')
            .onSnapshot((snapshot: any) => {
                const appsData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setPioneerApplications(appsData);
                setPioneerApplicationsLoading(false);
            }, (error: any) => {
                console.error("Error fetching pioneer applications:", error);
                setPioneerApplicationsLoading(false);
            });
        return () => unsubscribe();
    }, [user]);

    // --- Firestore Meeting Assignments Listener ---
    useEffect(() => {
        if (!user) {
            setMeetingAssignments([]);
            setAssignmentsLoading(false);
            return;
        }
        setAssignmentsLoading(true);
        const unsubscribe = db.collection('meeting_assignments')
            .onSnapshot((snapshot: any) => {
                const assignmentsData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setMeetingAssignments(assignmentsData);
                setAssignmentsLoading(false);
            }, (error: any) => {
                console.error("Error fetching meeting assignments:", error);
                setAssignmentsLoading(false);
            });
        return () => unsubscribe();
    }, [user]);

    // --- Firestore L&M Meeting Schedules Listener ---
    useEffect(() => {
        if (!user) {
            setLmSchedules([]);
            setLmSchedulesLoading(false);
            return;
        }
        setLmSchedulesLoading(true);
        const unsubscribe = db.collection('lm_meeting_schedules')
            .onSnapshot((snapshot: any) => {
                const schedulesData = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setLmSchedules(schedulesData);
                setLmSchedulesLoading(false);
            }, (error: any) => {
                console.error("Error fetching L&M meeting schedules:", error);
                setLmSchedulesLoading(false);
            });
        return () => unsubscribe();
    }, [user]);

    // --- Firestore Public Talks Schedule Listener ---
    useEffect(() => {
        if (!user) {
            setPublicTalksSchedule({});
            setPublicTalksLoading(false);
            return;
        }
        setPublicTalksLoading(true);
        const unsubscribe = db.collection('public_talks_schedule').doc('main_schedule')
            .onSnapshot((doc: any) => {
                if (doc.exists) {
                    setPublicTalksSchedule(doc.data());
                } else {
                    setPublicTalksSchedule({}); // No schedule exists yet
                }
                setPublicTalksLoading(false);
            }, (error: any) => {
                console.error("Error fetching public talks schedule:", error);
                setPublicTalksLoading(false);
            });
        return () => unsubscribe();
    }, [user]);

    // --- Firestore Pioneer Settings Real-time Listener ---
    useEffect(() => {
        if (!user) {
            setIs15HourOptionEnabled(true); // Default for logged out users
            setSettingsLoading(false);
            return;
        }
        setSettingsLoading(true);
        const unsubscribe = db.collection('settings').doc('pioneerOptions')
            .onSnapshot((doc: any) => {
                if (doc.exists) {
                    setIs15HourOptionEnabled(doc.data().is15HourOptionEnabled);
                } else {
                    db.collection('settings').doc('pioneerOptions').set({ is15HourOptionEnabled: true });
                    setIs15HourOptionEnabled(true);
                }
                setSettingsLoading(false);
            }, (error: any) => {
                console.error("Error fetching pioneer settings:", error);
                setIs15HourOptionEnabled(true); // Fallback to enabled
                setSettingsLoading(false);
            });
    
        return () => unsubscribe();
    }, [user]);
    
    // --- Firestore Service Committee Listener ---
    useEffect(() => {
        if (!user?.uid) return;
        const unsubscribe = db.collection('settings').doc('serviceCommittee')
            .onSnapshot((doc: any) => {
                const committeeUids = doc.exists ? doc.data().members : [];
                setUser(currentUser => 
                    currentUser ? { ...currentUser, isCommitteeMember: committeeUids.includes(currentUser.uid) } : null
                );
            });
        return () => unsubscribe();
    }, [user?.uid]);


    const handleLogout = useCallback(() => {
        auth.signOut();
        setForcePrecursorForm(false);
    }, []);

    const handleApplyForPioneer = useCallback(() => {
        setForcePrecursorForm(true);
        setActiveView('precursorAuxiliar');
    }, []);

    const handleSetActiveView = useCallback((view: View) => {
        setForcePrecursorForm(false);
        setActiveView(view);
    }, []);
    
    // --- Firestore & Storage CRUD Operations ---

    const uploadFile = async (
        file: File,
        path: string,
        onProgress?: (progress: number) => void
    ): Promise<string> => {
        return new Promise((resolve, reject) => {
            const metadata = { contentType: file.type };
            const fileRef = storage.ref().child(path);
            const uploadTask = fileRef.put(file, metadata);

            uploadTask.on(
                'state_changed',
                (snapshot: any) => {
                    if (onProgress) {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        onProgress(progress);
                    }
                },
                (error: any) => {
                    console.error("Upload failed:", error);
                    reject(error);
                },
                () => {
                    uploadTask.snapshot.ref.getDownloadURL()
                        .then(resolve)
                        .catch(reject);
                }
            );
        });
    };

    const handleAddPublisher = useCallback(async (publisherData: Omit<Publisher, 'id'>, onProgress?: (progress: number) => void) => {
        try {
            const dataToSave: any = { ...publisherData };
            const newDocRef = db.collection('publishers').doc();
            
            if (dataToSave.Foto && dataToSave.Foto instanceof File) {
                const photoURL = await uploadFile(dataToSave.Foto, `publishers/${newDocRef.id}/photo`, onProgress);
                dataToSave.Foto = photoURL;
            }

            if (dataToSave['Carta de presentacion'] && dataToSave['Carta de presentacion'] instanceof File) {
                const letterURL = await uploadFile(dataToSave['Carta de presentacion'], `publishers/${newDocRef.id}/letter`);
                dataToSave['Carta de presentacion'] = letterURL;
            }

            await newDocRef.set(dataToSave);
        } catch (error) {
            console.error("Error adding publisher:", error);
            setModalInfo({ type: 'error', title: 'Error al Añadir', message: 'No se pudo añadir el publicador. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleUpdatePublisher = useCallback(async (updatedPublisher: Publisher, onProgress?: (progress: number) => void) => {
        try {
            const { id, ...data } = updatedPublisher;
            const dataToSave: any = { ...data };
            
            if (dataToSave.Foto && dataToSave.Foto instanceof File) {
                const photoURL = await uploadFile(dataToSave.Foto, `publishers/${id}/photo`, onProgress);
                dataToSave.Foto = photoURL;
            }

            if (dataToSave['Carta de presentacion'] && dataToSave['Carta de presentacion'] instanceof File) {
                const letterURL = await uploadFile(dataToSave['Carta de presentacion'], `publishers/${id}/letter`);
                dataToSave['Carta de presentacion'] = letterURL;
            }

            await db.collection('publishers').doc(id).update(dataToSave);
        } catch (error) {
            console.error("Error updating publisher:", error);
            setModalInfo({ type: 'error', title: 'Error al Actualizar', message: 'No se pudo actualizar el publicador. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleDeletePublisher = useCallback(async (id: string) => {
        try {
            await db.collection('publishers').doc(id).delete();
        } catch (error) {
            console.error("Error deleting publisher:", error);
            setModalInfo({ type: 'error', title: 'Error al Borrar', message: 'No se pudo eliminar el publicador.' });
        }
    }, []);

    const handleUpdatePublisherAssignments = useCallback(async (publisherId: string, assignments: string[]) => {
        try {
            await db.collection('publishers').doc(publisherId).update({ asignacionesDisponibles: assignments });
        } catch (error) {
            console.error("Error updating publisher assignments:", error);
            setModalInfo({ type: 'error', title: 'Error de Asignación', message: 'No se pudieron actualizar las asignaciones del publicador.' });
            throw error;
        }
    }, []);

    const handleUpdatePublisherVyMAssignments = useCallback(async (publisherId: string, assignments: { [key: string]: boolean }) => {
        try {
            await db.collection('publishers').doc(publisherId).update(assignments);
        } catch (error) {
            console.error("Error updating publisher VyM assignments:", error);
            setModalInfo({ type: 'error', title: 'Error de Asignación', message: 'No se pudieron actualizar las asignaciones de Vida y Ministerio del publicador.' });
            throw error;
        }
    }, []);
    
    const handleSaveServiceReport = useCallback(async (reportData: Omit<ServiceReport, 'id'>) => {
        try {
            const { idPublicador, anioCalendario, mes, nombrePublicador } = reportData;
            let docId: string;
            const dataToSave: { [key: string]: any } = { ...reportData };
            
            if (nombrePublicador && idPublicador === 'public_submission') {
                docId = db.collection('service_reports').doc().id;
            } else {
                if (!idPublicador || !anioCalendario || !mes) {
                    throw new Error("Publicador, año y mes son requeridos para guardar un informe.");
                }
                docId = `${idPublicador}_${anioCalendario}_${mes}`;
            }
            
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key] === undefined || dataToSave[key] === '') {
                    dataToSave[key] = firebase.firestore.FieldValue.delete();
                }
            });

            await db.collection('service_reports').doc(docId).set(dataToSave, { merge: true });
        } catch (error) {
            console.error("Error saving service report:", error);
            setModalInfo({ type: 'error', title: 'Error al Guardar Informe', message: 'No se pudo guardar el informe de servicio. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleDeleteServiceReport = useCallback(async (reportId: string) => {
        try {
            await db.collection('service_reports').doc(reportId).delete();
        } catch (error) {
            console.error("Error deleting service report:", error);
            setModalInfo({ type: 'error', title: 'Error al Eliminar', message: 'No se pudo eliminar el informe de servicio. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleBatchUpdateServiceReports = useCallback(async (reportsToUpdate: Omit<ServiceReport, 'id'>[]) => {
        try {
            const batch = db.batch();
            reportsToUpdate.forEach(report => {
                const docId = `${report.idPublicador}_${report.anioCalendario}_${report.mes}`;
                const docRef = db.collection('service_reports').doc(docId);
                const dataToSave: { [key: string]: any } = { ...report };

                Object.keys(dataToSave).forEach((key) => {
                    if (dataToSave[key] === undefined || dataToSave[key] === '') {
                        dataToSave[key] = firebase.firestore.FieldValue.delete();
                    }
                });
                
                batch.set(docRef, dataToSave, { merge: true });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error batch updating reports:", error);
            setModalInfo({ type: 'error', title: 'Error al Guardar Informes', message: 'No se pudieron guardar los informes en lote. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleUpdatePublisherGroup = useCallback(async (publisherId: string, newGroup: string) => {
        try {
            await db.collection('publishers').doc(publisherId).update({ Grupo: newGroup });
        } catch (error) {
            console.error("Error updating publisher group:", error);
            setModalInfo({ type: 'error', title: 'Error de Grupo', message: 'No se pudo actualizar el grupo del publicador.' });
        }
    }, []);

    const handleSaveAttendance = useCallback(async (year: number, month: string, attendanceData: AsistenciaData) => {
        try {
            const docId = `${year}_${month}`;
            const dataToSave = {
                ano: year,
                mes: month,
                ...attendanceData
            };
            await db.collection('attendance_records').doc(docId).set(dataToSave, { merge: true });
        } catch (error) {
            console.error("Error saving attendance:", error);
            setModalInfo({ type: 'error', title: 'Error de Asistencia', message: 'No se pudo guardar la asistencia. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);
    
    const handleBatchUpdateAttendance = useCallback(async (recordsToUpdate: AttendanceRecord[]) => {
        try {
            const batch = db.batch();
            recordsToUpdate.forEach(record => {
                const { id, ...data } = record;
                const docRef = db.collection('attendance_records').doc(id);
                const dataToSave = {
                    ano: data.ano,
                    mes: data.mes,
                    es_sem1: data.es_sem1, es_sem2: data.es_sem2, es_sem3: data.es_sem3, es_sem4: data.es_sem4, es_sem5: data.es_sem5,
                    fs_sem1: data.fs_sem1, fs_sem2: data.fs_sem2, fs_sem3: data.fs_sem3, fs_sem4: data.fs_sem4, fs_sem5: data.fs_sem5,
                };
                batch.set(docRef, dataToSave, { merge: true });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error batch updating attendance:", error);
            setModalInfo({ type: 'error', title: 'Error de Asistencia', message: 'No se pudieron guardar los registros de asistencia en lote. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);
    
    const handleAddInvitationContent = useCallback(async (imageFile: File, phrase: string, onProgress?: (progress: number) => void) => {
        try {
            const newDocRef = db.collection('invitation_content').doc();
            const imageUrl = await uploadFile(imageFile, `invitation_images/${newDocRef.id}`, onProgress);
            await newDocRef.set({
                imageUrl,
                phrase,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding invitation content:", error);
            setModalInfo({ type: 'error', title: 'Error al Añadir Contenido', message: 'No se pudo añadir el contenido de invitación. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleDeleteInvitationContent = useCallback(async (contentId: string) => {
        try {
            await db.collection('invitation_content').doc(contentId).delete();
            const imageRef = storage.ref(`invitation_images/${contentId}`);
            await imageRef.delete();
        } catch (error) {
            console.error("Error deleting invitation content:", error);
        }
    }, []);

    const handleAddHomepageContent = useCallback(async (imageFile: File, title: string, phrase: string, onProgress?: (progress: number) => void) => {
        try {
            const newDocRef = db.collection('homepage_content').doc();
            const imageUrl = await uploadFile(imageFile, `homepage_images/${newDocRef.id}`, onProgress);
            await newDocRef.set({
                imageUrl,
                title,
                phrase,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding homepage content:", error);
            setModalInfo({ type: 'error', title: 'Error al Añadir Imagen', message: 'No se pudo añadir la imagen de inicio. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleDeleteHomepageContent = useCallback(async (contentId: string) => {
        try {
            await db.collection('homepage_content').doc(contentId).delete();
            const imageRef = storage.ref(`homepage_images/${contentId}`);
            await imageRef.delete();
        } catch (error) {
            console.error("Error deleting homepage content:", error);
        }
    }, []);

    const handleUpdate15HourOption = useCallback(async (isEnabled: boolean) => {
        try {
            await db.collection('settings').doc('pioneerOptions').set({ is15HourOptionEnabled: isEnabled });
        } catch (error) {
            console.error("Error updating 15-hour option:", error);
            setModalInfo({ type: 'error', title: 'Error de Configuración', message: 'No se pudo actualizar la configuración de campaña.' });
        }
    }, []);

    const handleSaveTerritoryRecord = useCallback(async (recordData: Omit<TerritoryRecord, 'id'>) => {
        try {
            const { serviceYear, terrNum, vueltaNum } = recordData;
            const docId = `${serviceYear}_${terrNum}_${vueltaNum}`;
            const dataToSave = Object.fromEntries(Object.entries(recordData).filter(([_, v]) => v !== undefined));
            await db.collection('territory_records').doc(docId).set(dataToSave, { merge: true });
        } catch (error) {
            console.error("Error saving territory record:", error);
            setModalInfo({ type: 'error', title: 'Error de Territorio', message: 'No se pudo guardar el registro del territorio. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleDeleteTerritoryRecord = useCallback(async (recordData: Partial<TerritoryRecord>) => {
        try {
            if (!recordData.serviceYear || !recordData.terrNum || !recordData.vueltaNum) {
                throw new Error("Datos incompletos para eliminar el registro.");
            }
            const docId = `${recordData.serviceYear}_${recordData.terrNum}_${recordData.vueltaNum}`;
            await db.collection('territory_records').doc(docId).delete();
        } catch (error) {
            console.error("Error deleting territory record:", error);
            setModalInfo({ type: 'error', title: 'Error de Territorio', message: 'No se pudo eliminar el registro del territorio. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleSaveMeetingSchedule = useCallback(async (schedule: Omit<MeetingAssignmentSchedule, 'id'>) => {
        try {
            const docId = `${schedule.year}-${schedule.month}`;
            await db.collection('meeting_assignments').doc(docId).set(schedule, { merge: true });
            setModalInfo({ type: 'success', title: 'Éxito', message: `El programa de asignaciones para ${schedule.month} ${schedule.year} se ha guardado correctamente.` });
        } catch (error) {
            console.error("Error saving meeting schedule:", error);
            setModalInfo({ type: 'error', title: 'Error al Guardar', message: 'No se pudo guardar el programa de asignaciones. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleSaveLMSchedule = useCallback(async (schedule: Omit<LMMeetingSchedule, 'id'>) => {
        try {
            const docId = `${schedule.year}-${schedule.month}`;
            await db.collection('lm_meeting_schedules').doc(docId).set(schedule, { merge: true });
            setModalInfo({ type: 'success', title: 'Éxito', message: `El programa de Vida y Ministerio para ${schedule.month} ${schedule.year} se ha guardado correctamente.` });
        } catch (error) {
            console.error("Error saving L&M meeting schedule:", error);
            setModalInfo({ type: 'error', title: 'Error al Guardar', message: 'No se pudo guardar el programa de Vida y Ministerio. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleSavePublicTalksSchedule = useCallback(async (schedule: PublicTalksSchedule) => {
        try {
            await db.collection('public_talks_schedule').doc('main_schedule').set(schedule);
        } catch (error) {
            console.error("Error saving public talks schedule:", error);
            setModalInfo({ type: 'error', title: 'Error al Guardar', message: 'No se pudo guardar el programa de discursos públicos. Error: ' + (error as Error).message });
            throw error;
        }
    }, []);

    const handleResetData = useCallback(async () => {
        if (window.confirm('¿Estás seguro de que deseas BORRAR PERMANENTEMENTE todos los datos de publicadores, informes de servicio, registros de asistencia y territorios? Esta acción no se puede deshacer y dejará la aplicación en blanco.')) {
            try {
                const pubSnapshot = await db.collection('publishers').get();
                const pubBatch = db.batch();
                pubSnapshot.docs.forEach((doc: any) => pubBatch.delete(doc.ref));
                await pubBatch.commit();
                const reportSnapshot = await db.collection('service_reports').get();
                const reportBatch = db.batch();
                reportSnapshot.docs.forEach((doc: any) => reportBatch.delete(doc.ref));
                await reportBatch.commit();
                const attendanceSnapshot = await db.collection('attendance_records').get();
                const attendanceBatch = db.batch();
                attendanceSnapshot.docs.forEach((doc: any) => attendanceBatch.delete(doc.ref));
                await attendanceBatch.commit();
                const territorySnapshot = await db.collection('territory_records').get();
                const territoryBatch = db.batch();
                territorySnapshot.docs.forEach((doc: any) => territoryBatch.delete(doc.ref));
                await territoryBatch.commit();
                setModalInfo({ type: 'success', title: 'Operación Exitosa', message: '¡Todos los datos han sido borrados con éxito!' });
            } catch (error) {
                 console.error("Error limpiando los datos:", error);
                 setModalInfo({ type: 'error', title: 'Error de Limpieza', message: 'Hubo un error al limpiar los datos.' });
            }
        }
    }, []);

    const handleUpdateUserPermissions = useCallback(async (userId: string, permissions: Permission[]) => {
        try {
            await db.collection('users').doc(userId).update({ permissions });
        } catch (error) {
            console.error("Error updating user permissions:", error);
            setModalInfo({ type: 'error', title: 'Error de Permisos', message: 'No se pudieron actualizar los permisos del usuario.' });
            throw error;
        }
    }, []);

    const handleUpdateServiceCommittee = useCallback(async (memberUids: string[]) => {
        try {
            await db.collection('settings').doc('serviceCommittee').set({ members: memberUids });
        } catch (error) {
            console.error("Error updating service committee:", error);
            setModalInfo({ type: 'error', title: 'Error de Comité', message: 'No se pudo actualizar el comité de servicio.' });
            throw error;
        }
    }, []);

    const handleLinkUserToPublisher = useCallback(async (userId: string, publisherId: string) => {
        const batch = db.batch();

        // 1. Unlink any publisher currently linked to this user
        const previouslyLinkedQuery = db.collection('publishers').where('authUid', '==', userId);
        const previouslyLinkedSnapshot = await previouslyLinkedQuery.get();
        previouslyLinkedSnapshot.forEach((doc: any) => {
            batch.update(doc.ref, { authUid: firebase.firestore.FieldValue.delete() });
        });

        // 2. Link the new publisher
        const publisherRef = db.collection('publishers').doc(publisherId);
        batch.update(publisherRef, { authUid: userId });

        await batch.commit();
    }, []);


    const renderView = () => {
        const isLoading = publishersLoading || reportsLoading || attendanceLoading || invitationContentLoading || homepageContentLoading || settingsLoading || territoryLoading || assignmentsLoading || lmSchedulesLoading || pioneerApplicationsLoading || publicTalksLoading;
        if (isLoading && user) {
            return <div className="flex justify-center items-center h-full">Cargando datos...</div>;
        }
        
        const hasPermission = (permission: View | GranularPermission) => {
            if (!user) return false;
            return user.role === 'admin' || user.permissions.includes(permission);
        };

        switch (activeView) {
            case 'asistenciaForm': return <AsistenciaForm attendanceRecords={attendanceRecords} onSave={handleSaveAttendance} />;
            case 'asistenciaReporte': return <AsistenciaReporte attendanceRecords={attendanceRecords} onBatchUpdateAttendance={handleBatchUpdateAttendance} canEdit={hasPermission('editAsistenciaReporte')} />;
            case 'publicadores':
                return <Publicadores 
                            publishers={publishers} 
                            onAdd={handleAddPublisher} 
                            onUpdate={handleUpdatePublisher} 
                            onDelete={handleDeletePublisher} 
                            onShowModal={setModalInfo}
                            canManage={hasPermission('managePublicadores')}
                        />;
            case 'registrosServicio': return <RegistrosServicio publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} onDeleteServiceReport={handleDeleteServiceReport} canEdit={hasPermission('editRegistrosServicio')} />;
            // FIX: Corrected typo in function name from 'handleBatchUpdateReports' to 'handleBatchUpdateServiceReports' to match its definition.
            case 'informeMensualGrupo': return <InformeMensualGrupo publishers={publishers} serviceReports={serviceReports} onBatchUpdateReports={handleBatchUpdateServiceReports} />;
            case 'informeMensualConsolidado': return <InformeMensualConsolidado publishers={publishers} serviceReports={serviceReports} />;
            case 'dashboardCursos': return <DashboardCursos publishers={publishers} serviceReports={serviceReports} />;
            case 'dashboardPrecursores': return <DashboardPrecursores publishers={publishers} serviceReports={serviceReports} pioneerApplications={pioneerApplications} />;
            case 'grupos': return <Grupos publishers={publishers} onUpdateGroup={handleUpdatePublisherGroup} canManage={hasPermission('manageGrupos')} />;
            case 'informeServicio': return <InformeServicio publishers={publishers} serviceReports={serviceReports} onSaveReport={handleSaveServiceReport} onApplyForPioneer={handleApplyForPioneer} invitationContent={invitationContent} />;
            case 'territorios': return <Territorios records={territoryRecords} onSave={handleSaveTerritoryRecord} onDelete={handleDeleteTerritoryRecord} />;
            case 'precursorAuxiliar': return <PrecursorAuxiliar userRole={user!.role} isCommitteeMember={user!.isCommitteeMember} forceFormView={forcePrecursorForm} is15HourOptionEnabled={is15HourOptionEnabled} />;
            case 'controlAcceso': return <ControlAcceso users={users} publishers={publishers} onUpdateUserPermissions={handleUpdateUserPermissions} onUpdateServiceCommittee={handleUpdateServiceCommittee} onLinkUserToPublisher={handleLinkUserToPublisher} />;
            case 'gestionContenidoInvitacion': return <GestionContenidoInvitacion 
                invitationContent={invitationContent} 
                onAddInvitation={handleAddInvitationContent} 
                onDeleteInvitation={handleDeleteInvitationContent} 
                is15HourOptionEnabled={is15HourOptionEnabled} 
                onUpdate15HourOption={handleUpdate15HourOption}
                homepageContent={homepageContent}
                onAddHomepageContent={handleAddHomepageContent}
                onDeleteHomepageContent={handleDeleteHomepageContent}
            />;
            case 'asignacionesReunion': return <AsignacionesReunion 
                publishers={publishers} 
                schedules={meetingAssignments} 
                onSaveSchedule={handleSaveMeetingSchedule}
                onUpdatePublisherAssignments={handleUpdatePublisherAssignments}
                onShowModal={setModalInfo}
                canConfig={hasPermission('configAsignacionesReunion')}
            />;
            case 'programaServiciosAuxiliares': return <ProgramaServiciosAuxiliares
                schedules={meetingAssignments}
                publishers={publishers}
                onShowModal={setModalInfo}
            />;
            case 'vidaYMinisterio': return <VidaYMinisterio
                publishers={publishers}
                lmSchedules={lmSchedules}
                onSaveSchedule={handleSaveLMSchedule}
                onUpdatePublisherVyMAssignments={handleUpdatePublisherVyMAssignments}
                onShowModal={setModalInfo}
                canConfig={hasPermission('configVidaYMinisterio')}
            />;
            case 'registroTransaccion': return <RegistroTransaccion />;
            case 'reunionPublica': return <ReunionPublica schedule={publicTalksSchedule} onSave={handleSavePublicTalksSchedule} canManage={hasPermission('managePublicTalks')} />;
            case 'home': default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <h1 className="text-3xl font-bold">Bienvenido al Centro de Control</h1>
                        <p className="mt-2 text-xl text-gray-800">Cong. Cerro de la Silla-Guadalupe</p>
                        <p className="mt-4 text-lg">Seleccione una herramienta del menú para comenzar.</p>
                    </div>
                );
        }
    };
    
    if (authLoading) {
         return <div className="flex justify-center items-center h-screen">Cargando...</div>;
    }

    if (!user) {
        const renderFormInModal = () => {
            const isLoading = settingsLoading || invitationContentLoading || publishersLoading;
            if (isLoading) {
                return <div className="flex justify-center items-center p-8">Cargando formulario...</div>;
            }

            switch (activeFormModal) {
                case 'informeServicio':
                    return <InformeServicio
                        publishers={publishers}
                        serviceReports={[]}
                        onSaveReport={handleSaveServiceReport}
                        onApplyForPioneer={() => setActiveFormModal('precursorAuxiliar')}
                        invitationContent={invitationContent}
                    />;
                case 'precursorAuxiliar':
                     return <PrecursorAuxiliar
                        userRole="publisher"
                        isCommitteeMember={false}
                        is15HourOptionEnabled={is15HourOptionEnabled}
                        forceFormView={true}
                    />;
                default:
                    return null;
            }
        };

        return (
            <div className="bg-gray-100 min-h-screen">
                <TopNavBar 
                    onLoginClick={() => setIsLoginModalOpen(true)} 
                    onFormClick={(form) => setActiveFormModal(form)}
                />
                {isLoginModalOpen && <Login onClose={() => setIsLoginModalOpen(false)} />}
                
                <HomePage onFormClick={(form) => setActiveFormModal(form)} homepageContent={homepageContent} />
                
                {activeFormModal && (
                    <FormModal onClose={() => setActiveFormModal(null)}>
                        {renderFormInModal()}
                    </FormModal>
                )}

                <InfoModal info={modalInfo} onClose={() => setModalInfo(null)} />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-100">
            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
            <Sidebar 
                activeView={activeView} 
                setActiveView={handleSetActiveView} 
                onLogout={handleLogout} 
                userRole={user.role} 
                onResetData={handleResetData}
                userPermissions={user.permissions}
                isCommitteeMember={user.isCommitteeMember}
            />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                {renderView()}
            </main>
            <InfoModal info={modalInfo} onClose={() => setModalInfo(null)} />
        </div>
    );
};

export default App;
