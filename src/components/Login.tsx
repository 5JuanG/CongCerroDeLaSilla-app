import React, { useState } from 'react';

declare const auth: any;
declare const db: any;

interface LoginProps {
    onClose: () => void;
}

const Login: React.FC<LoginProps> = ({ onClose }) => {
    const [isPanelActive, setIsPanelActive] = useState(false);
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
            } else if (action === 'register') {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                try {
                    await db.collection('users').doc(userCredential.user.uid).set({
                        email: userCredential.user.email,
                        role: 'publisher',
                        permissions: []
                    });
                } catch (dbError) {
                    console.error("Firestore document creation failed, rolling back auth user:", dbError);
                    if (userCredential?.user) {
                        await userCredential.user.delete();
                    }
                    throw new Error("No se pudo crear su perfil de usuario. Intente de nuevo.");
                }
            } else if (action === 'reset') {
                await auth.sendPasswordResetEmail(email);
                setMessage('Se ha enviado un enlace para restablecer la contraseña a tu correo.');
                setView('login');
            }
        } catch (err: any) {
            handleAuthError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAuthError = (err: any) => {
        console.error("Firebase Auth Error:", err);
        let friendlyMessage = 'Ocurrió un problema de autenticación. Verifica tus datos e intenta de nuevo.';

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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 fade-in" onClick={onClose}>
            <div
                className={`container-login glass rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative overflow-hidden w-full max-w-4xl min-h-[550px] md:min-h-[500px] border border-white/30 transition-all duration-700 ${isPanelActive ? 'right-panel-active' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-6 text-white/70 hover:text-white text-3xl z-[101] transition-colors p-2 rounded-full hover:bg-white/10">&times;</button>

                {/* Desktop Overlay Background Image */}
                <div className="absolute inset-0 z-0 hidden md:block">
                    <img
                        src="/hero-bg.png"
                        alt="Graceful Background"
                        className="w-full h-full object-cover opacity-20 blur-[2px]"
                    />
                </div>

                {/* Forms Containers */}
                <div className="form-container sign-up-container z-20">
                    <Form onSubmit={(e) => handleAuthAction(e, 'register')} title="Crear Cuenta" buttonText="Registrarse" {...commonFormProps} />
                </div>

                <div className="form-container sign-in-container z-20">
                    {view === 'reset'
                        ? <Form onSubmit={(e) => handleAuthAction(e, 'reset')} title="Contraseña" buttonText="Enviar Enlace" isReset={true} {...commonFormProps} />
                        : <Form onSubmit={(e) => handleAuthAction(e, 'login')} title="Iniciar Sesión" buttonText="Entrar" {...commonFormProps} />
                    }
                </div>

                <div className="form-container sign-up-container-mobile">
                    <Form onSubmit={(e) => handleAuthAction(e, 'register')} title="Crear Cuenta" buttonText="Registrarse" {...commonFormProps} />
                </div>

                {/* Sliding Overlay (Desktop Only) */}
                <div className="overlay-container hidden md:block">
                    <div className="overlay">
                        <div className="overlay-panel overlay-left">
                            <h2 className="text-4xl font-black mb-6">¿Ya eres parte?</h2>
                            <p className="text-lg opacity-90 mb-8 leading-relaxed max-w-[280px]">Inicia sesión para acceder a toda la información de la congregación.</p>
                            <button onClick={() => toggleView('login')} className="ghost-button-login">Entrar Ahora</button>
                        </div>
                        <div className="overlay-panel overlay-right">
                            <h2 className="text-4xl font-black mb-6">¡Empieza Hoy!</h2>
                            <p className="text-lg opacity-90 mb-8 leading-relaxed max-w-[280px]">Regístrate para colaborar con los reportes y actividades virtuales.</p>
                            <button onClick={() => toggleView('register')} className="ghost-button-login">Crear Cuenta</button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .container-login {
                    background: rgba(255, 255, 255, 0.45);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                }
                .form-container {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    transition: all 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                }
                .form-container form {
                    background: transparent;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    padding: 0 40px;
                    height: 100%;
                    text-align: center;
                }
                
                .sign-in-container {
                    left: 0;
                    width: 100%;
                    z-index: 2;
                }
                .sign-up-container {
                    display: none;
                    left: 0;
                    width: 50%;
                    opacity: 0;
                    z-index: 1;
                }
                .sign-up-container-mobile {
                    display: block;
                    left: 0;
                    width: 100%;
                    z-index: 1;
                    opacity: 0;
                    pointer-events: none;
                }
                .overlay-container {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    width: 50%;
                    height: 100%;
                    overflow: hidden;
                    transition: transform 0.7s ease-in-out;
                    z-index: 100;
                }
                .overlay {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: #FFFFFF;
                    position: relative;
                    left: -100%;
                    height: 100%;
                    width: 200%;
                    transform: translateX(0);
                    transition: transform 0.7s ease-in-out;
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
                    transition: transform 0.7s ease-in-out;
                }
                .overlay-left { transform: translateX(-20%); }
                .overlay-right { right: 0; transform: translateX(0); }
                
                .ghost-button-login {
                    background: transparent;
                    border: 2px solid #ffffff;
                    border-radius: 1.5rem;
                    color: #ffffff;
                    font-size: 0.875rem;
                    font-weight: 800;
                    padding: 0.8rem 3rem;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    transition: all 0.3s;
                }
                .ghost-button-login:hover {
                    background: #ffffff;
                    color: #1e3a8a;
                    transform: translateY(-2px);
                }
                .ghost-button-login:active { transform: translateY(0); }

                @media (min-width: 768px) {
                    .sign-in-container { width: 50%; }
                    .sign-up-container { display: flex; }
                    .sign-up-container-mobile { display: none; }
                    
                    .container-login.right-panel-active .sign-in-container {
                        transform: translateX(100%);
                    }
                    .container-login.right-panel-active .sign-up-container {
                        transform: translateX(100%);
                        opacity: 1;
                        z-index: 5;
                        animation: show-login 0.7s;
                    }
                    .container-login.right-panel-active .overlay-container {
                        transform: translateX(-100%);
                    }
                    .container-login.right-panel-active .overlay {
                        transform: translateX(50%);
                    }
                    .container-login.right-panel-active .overlay-left { transform: translateX(0); }
                    .container-login.right-panel-active .overlay-right { transform: translateX(20%); }
                }

                .container-login.right-panel-active .sign-in-container {
                    opacity: 0;
                    pointer-events: none;
                }
                .container-login.right-panel-active .sign-up-container-mobile {
                    opacity: 1;
                    pointer-events: auto;
                }

                @keyframes show-login {
                    0%, 49.99% { opacity: 0; z-index: 1; }
                    50%, 100% { opacity: 1; z-index: 5; }
                }
                
                .login-input {
                    background: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    transition: border 0.3s, background 0.3s;
                }
                .login-input:focus {
                    background: #ffffff;
                    border-color: #3b82f6;
                    outline: none;
                }
            `}</style>
        </div>
    );
};

const Form = ({
    onSubmit, title, buttonText, isReset = false,
    email, password, setEmail, setPassword, loading, error, message, toggleView
}: any) => {
    const [showPassword, setShowPassword] = useState(false);
    const isLogin = title === "Iniciar Sesión";
    const isRegister = title === "Crear Cuenta";

    return (
        <form onSubmit={onSubmit} className="w-full">
            <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">{title}</h2>

            <div className="w-full space-y-4 mb-6">
                <div className="relative">
                    <input
                        type="email"
                        placeholder="Correo Electrónico"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="login-input py-4 px-6 w-full rounded-2xl text-slate-700 shadow-sm"
                    />
                </div>

                {!isReset && (
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="login-input py-4 px-6 w-full rounded-2xl text-slate-700 shadow-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                            {showPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {isLogin && (
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); toggleView('reset'); }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mb-6"
                >
                    ¿Olvidaste tu contraseña?
                </button>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-base font-black py-4 px-8 tracking-wider uppercase transition-all shadow-lg shadow-blue-200 active:scale-[0.98] disabled:bg-slate-400 disabled:shadow-none"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Procesando...
                    </span>
                ) : buttonText}
            </button>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl mt-6 text-sm font-medium border border-red-100 flex items-center gap-3 animate-shake" role="alert">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
            {message && (
                <div className="bg-green-50 text-green-600 p-4 rounded-2xl mt-6 text-sm font-medium border border-green-100 flex items-center gap-3 anim-fade" role="alert">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{message}</span>
                </div>
            )}

            <div className="md:hidden mt-8 text-sm font-bold text-slate-500">
                {isLogin && (
                    <p>¿No tienes una cuenta? <button type="button" onClick={() => toggleView('register')} className="underline text-blue-600">Regístrate</button></p>
                )}
                {isRegister && (
                    <p>¿Ya tienes una cuenta? <button type="button" onClick={() => toggleView('login')} className="underline text-blue-600">Inicia Sesión</button></p>
                )}
                {isReset && (
                    <button type="button" onClick={() => toggleView('login')} className="underline text-blue-600">Volver a Inicio</button>
                )}
            </div>
        </form>
    );
};

export default Login;