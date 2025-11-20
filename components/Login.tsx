import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
    const { signInWithGoogle } = useAuth();

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-primary-600 to-indigo-500 rounded-2xl flex items-center justify-center font-bold text-3xl text-white mx-auto mb-4 shadow-lg shadow-primary-900/50">
                        M
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">MetalMaster ERP</h1>
                    <p className="text-slate-400">Система управления торговлей металлом</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={signInWithGoogle}
                        className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg group"
                    >
                        <img
                            src="https://www.google.com/favicon.ico"
                            alt="Google"
                            className="w-5 h-5"
                        />
                        <span>Войти через Google</span>
                        <LogIn className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors ml-auto" />
                    </button>
                </div>

                <div className="mt-8 text-center text-xs text-slate-500">
                    <p>© 2024 MetalMaster. Все права защищены.</p>
                </div>
            </div>
        </div>
    );
};
