import React, { useState } from 'react';

declare const auth: any;
declare const db: any;

interface LoginProps {
    onClose: () => void;
}

const Login: React.FC<LoginProps> = ({ onClose }) => {
    const [isPanelActive, setIsPanelActive] = useState(false);
    // This state now primarily drives the mobile view and the content of the sign-in form (login vs reset)
    const [view, setView] = useState<'login' | 'register' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuthAction = async (e: React.FormEvent, action: 'login' | 'register' | 'reset') => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            if (action === 'login') {
                await auth.signInWithEmailAndPassword(email, password);
                // The onAuthStateChanged listener in App.tsx will now handle closing the modal.
            } else if (action === 'register') {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                try {
                    // After creating the auth user, immediately create their user profile document.
                    await db.collection('users').doc(userCredential.user.uid).set({
                        email: userCredential.user.email,
                        role: 'publisher',
                        permissions: []
                    });
                    // Success! onAuthStateChanged will now take over.
                } catch (dbError) {
                    // IMPORTANT: If Firestore document creation fails, attempt to roll back the auth user.
                    console.error("Firestore document creation failed, rolling back auth user:", dbError);
                    if (userCredential?.user) {
                        await userCredential.user.delete();
                    }
                    throw new Error("No se pudo crear su perfil de usuario. Intente de nuevo.");
                }
            } else if (action === 'reset') {
                await auth.sendPasswordResetEmail(email);
                setMessage('Se ha enviado un enlace para restablecer la contraseña a tu correo.');
                setView('login'); // Switch back to login view after sending
            }
        } catch (err: any) {
            handleAuthError(err);
        } finally {
            setLoading(false);
        }
    };
    
    const handleAuthError = (err: any) => {
        console.error("Firebase Auth Error:", err); // Log the original error for debugging.
        let friendlyMessage = 'Ocurrió un problema de autenticación. Verifica tus datos e intenta de nuevo.';
        
        // Comprehensive error handling for Firebase v8
        switch (err.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                friendlyMessage = 'Correo electrónico o contraseña incorrectos.';
                break;
            case 'auth/invalid-email':
                friendlyMessage = 'El formato del correo electrónico no es válido.';
                break;
            case 'auth/user-disabled':
                friendlyMessage = 'Esta cuenta de usuario ha sido deshabilitada.';
                break;
            case 'auth/network-request-failed':
                friendlyMessage = 'Error de red. Por favor, revisa tu conexión a internet.';
                break;
            case 'auth/too-many-requests':
                friendlyMessage = 'Acceso bloqueado temporalmente debido a demasiados intentos fallidos. Inténtalo más tarde.';
                break;
            case 'auth/email-already-in-use':
                friendlyMessage = 'Este correo electrónico ya está registrado.';
                break;
            case 'auth/weak-password':
                friendlyMessage = 'La contraseña debe tener al menos 6 caracteres.';
                break;
        }
        setError(friendlyMessage);
    };
    
    // This function now just clears errors and toggles the panel/view states
    const toggleView = (newView: 'login' | 'register' | 'reset') => {
        setError('');
        setMessage('');
        setView(newView);
        setIsPanelActive(newView === 'register');
    };

    const commonFormProps = {
        email,
        password,
        setEmail,
        setPassword,
        loading,
        error,
        message,
        toggleView,
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            {/* The main container's class is toggled to trigger all animations */}
            <div 
                className={`container bg-white rounded-2xl shadow-2xl relative overflow-hidden w-full max-w-4xl min-h-[520px] md:min-h-[480px] ${isPanelActive ? 'right-panel-active' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Universal Close Button */}
                <button onClick={onClose} className="absolute top-2 right-4 text-gray-500 hover:text-gray-800 text-3xl z-[101]">&times;</button>
                
                {/* Sign Up Form Container (Desktop) */}
                <div className="form-container sign-up-container">
                    <Form onSubmit={(e) => handleAuthAction(e, 'register')} title="Crear Cuenta" buttonText="Registrarse" {...commonFormProps} />
                </div>

                {/* Sign In / Reset Form Container (Desktop & Mobile) */}
                <div className="form-container sign-in-container">
                    {view === 'reset' 
                        ? <Form onSubmit={(e) => handleAuthAction(e, 'reset')} title="Restablecer Contraseña" buttonText="Enviar Enlace" isReset={true} {...commonFormProps} />
                        : <Form onSubmit={(e) => handleAuthAction(e, 'login')} title="Iniciar Sesión" buttonText="Entrar" {...commonFormProps} />
                    }
                </div>
                
                {/* Mobile-only registration form container (for stacking) */}
                 <div className="form-container sign-up-container-mobile">
                     <Form onSubmit={(e) => handleAuthAction(e, 'register')} title="Crear Cuenta" buttonText="Registrarse" {...commonFormProps} />
                </div>

                {/* Sliding Overlay (Desktop) */}
                <div className="overlay-container">
                    <div className="overlay">
                        <div className="overlay-panel overlay-left">
                            <h1 className="font-bold text-3xl mb-4">¡Hola de nuevo!</h1>
                            <p className="text-base leading-relaxed mb-4">¿Ya tienes una cuenta? Inicia sesión para continuar.</p>
                            <button onClick={() => toggleView('login')} className="ghost-button">Iniciar Sesión</button>
                        </div>
                        <div className="overlay-panel overlay-right">
                            <h1 className="font-bold text-3xl mb-4">¡Bienvenido!</h1>
                            <p className="text-base leading-relaxed mb-4">¿No tienes una cuenta? Regístrate para comenzar.</p>
                            <button onClick={() => toggleView('register')} className="ghost-button">Registrarse</button>
                        </div>
                    </div>
                </div>
            </div>
             <style>{`
                .container {
                    box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
                }
                .form-container {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    transition: all 0.6s ease-in-out;
                }
                .form-container form {
                    background-color: #FFFFFF;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    padding: 0 50px;
                    height: 100%;
                    text-align: center;
                }

                /* --- Desktop Animation Logic --- */
                /* Base positions */
                .sign-in-container {
                    left: 0;
                    width: 100%; /* Changed from 50% to fix mobile view */
                    z-index: 2;
                }
                .sign-up-container { /* This is the DESKTOP sign-up, hidden by default */
                    display: none; /* Hidden on mobile by default */
                    left: 0;
                    width: 50%;
                    opacity: 0;
                    z-index: 1;
                }
                 .sign-up-container-mobile { /* This is for MOBILE STACKING */
                    display: block;
                    left: 0;
                    width: 100%;
                    z-index: 1;
                    opacity: 0;
                    pointer-events: none;
                }
                .overlay-container {
                    display: none; /* Hidden on mobile */
                    position: absolute;
                    top: 0;
                    left: 50%;
                    width: 50%;
                    height: 100%;
                    overflow: hidden;
                    transition: transform 0.6s ease-in-out;
                    z-index: 100;
                }
                .overlay {
                    background: #2563EB;
                    background: linear-gradient(to right, #3B82F6, #2563EB);
                    color: #FFFFFF;
                    position: relative;
                    left: -100%;
                    height: 100%;
                    width: 200%;
                    transform: translateX(0);
                    transition: transform 0.6s ease-in-out;
                }
                .overlay-panel {
                    position: absolute;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    padding: 0 40px;
                    text-align: center;
                    top: 0;
                    height: 100%;
                    width: 50%;
                    transform: translateX(0);
                    transition: transform 0.6s ease-in-out;
                }
                .overlay-left { transform: translateX(-20%); }
                .overlay-right { right: 0; transform: translateX(0); }
                
                button.ghost-button {
                    background-color: transparent;
                    border-color: #ffffff;
                    border-width: 1px;
                    border-radius: 9999px; color: #ffffff;
                    font-size: 0.875rem; font-weight: bold; padding: 0.75rem 2.75rem;
                    letter-spacing: 0.05em; text-transform: uppercase;
                    transition: transform 80ms ease-in;
                }
                button.ghost-button:active { transform: scale(0.95); }

                /* --- Responsive Breakpoint (md) --- */
                @media (min-width: 768px) {
                    .sign-in-container { width: 50%; }
                    .sign-up-container { display: flex; } /* Show desktop version */
                    .sign-up-container-mobile { display: none; } /* Hide mobile version */
                    .overlay-container { display: block; }

                    /* Active State Animations */
                    .container.right-panel-active .sign-in-container {
                        transform: translateX(100%);
                    }
                    .container.right-panel-active .sign-up-container {
                        transform: translateX(100%);
                        opacity: 1;
                        z-index: 5;
                        animation: show 0.6s;
                    }
                    .container.right-panel-active .overlay-container {
                        transform: translateX(-100%);
                    }
                    .container.right-panel-active .overlay {
                        transform: translateX(50%);
                    }
                    .container.right-panel-active .overlay-left { transform: translateX(0); }
                    .container.right-panel-active .overlay-right { transform: translateX(20%); }
                }

                /* Mobile View Logic */
                .container.right-panel-active .sign-in-container {
                    opacity: 0;
                    pointer-events: none;
                }
                .container.right-panel-active .sign-up-container-mobile {
                    opacity: 1;
                    pointer-events: auto;
                }

                @keyframes show {
                    0%, 49.99% { opacity: 0; z-index: 1; }
                    50%, 100% { opacity: 1; z-index: 5; }
                }
            `}</style>
        </div>
    );
};

// A generic form component to reduce repetition
const Form = ({
    onSubmit, title, buttonText, isReset = false,
    email, password, setEmail, setPassword, loading, error, message, toggleView
}: any) => {
    const [showPassword, setShowPassword] = useState(false);
    const isLogin = title === "Iniciar Sesión";
    const isRegister = title === "Crear Cuenta";

    return (
        <form onSubmit={onSubmit}>
            <h1 className="font-bold text-3xl mb-4">{title}</h1>
            {isReset && <p className="text-sm text-gray-600 mb-4">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>}
            
            <input type="email" placeholder="Correo Electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Correo Electrónico" className="bg-gray-200 border-0 py-3 px-4 my-2 w-full rounded-lg"/>
            
            {!isReset && (
                <div className="relative w-full my-2">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-label="Contraseña"
                        className="bg-gray-200 border-0 py-3 px-4 w-full rounded-lg pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-600 hover:text-gray-800"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        )}
                    </button>
                </div>
            )}
            
            {isLogin && <a href="#" onClick={(e) => { e.preventDefault(); toggleView('reset'); }} className="text-sm text-blue-600 hover:underline my-2">¿Olvidaste tu contraseña?</a>}
            
            <button type="submit" disabled={loading} className="rounded-full border border-blue-600 bg-blue-600 text-white text-sm font-bold py-3 px-11 tracking-wider uppercase transition-transform duration-100 ease-in active:scale-95 focus:outline-none mt-4 disabled:bg-gray-400">
                {loading ? 'Cargando...' : buttonText}
            </button>
            
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md relative mt-4 text-sm flex items-start" role="alert">
                    <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
            {message && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md relative mt-4 text-sm flex items-start" role="alert">
                    <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{message}</span>
                </div>
            )}
            
            {/* Mobile View Toggles */}
            <div className="md:hidden mt-4 text-sm">
                {isLogin && <a href="#" onClick={(e) => { e.preventDefault(); toggleView('register'); }} className="text-blue-600 hover:underline">¿No tienes una cuenta? Regístrate</a>}
                {isRegister && <a href="#" onClick={(e) => { e.preventDefault(); toggleView('login'); }} className="text-blue-600 hover:underline">¿Ya tienes una cuenta? Inicia Sesión</a>}
                {isReset && <a href="#" onClick={(e) => { e.preventDefault(); toggleView('login'); }} className="text-blue-600 hover:underline">Volver a Iniciar Sesión</a>}
            </div>
        </form>
    );
};

export default Login;