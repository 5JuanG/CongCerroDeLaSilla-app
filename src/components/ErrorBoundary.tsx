import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-auto border-l-4 border-red-500">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">¡Ups! Algo salió mal.</h1>
                        <p className="text-gray-700 mb-4">Se ha producido un error inesperado en la aplicación.</p>

                        <div className="bg-gray-50 p-4 rounded border border-gray-200 overflow-auto text-sm font-mono text-gray-800">
                            <p className="font-bold mb-2">{this.state.error && this.state.error.toString()}</p>
                            <div className="whitespace-pre-wrap pl-4 border-l-2 border-gray-300">
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors"
                        >
                            Recargar Aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
