import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    accessToken: string | null;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            // Note: onAuthStateChanged doesn't provide the access token for API calls directly on refresh.
            // In a production app, we might need to handle token persistence or silent refresh differently.
            // For this MVP, we'll rely on the initial sign-in or re-auth.
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                setAccessToken(credential.accessToken);
                // Save to local storage temporarily to persist across reloads for this simple implementation
                localStorage.setItem('google_access_token', credential.accessToken);
            }
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setAccessToken(null);
            localStorage.removeItem('google_access_token');
        } catch (error) {
            console.error("Error signing out", error);
            throw error;
        }
    };

    // Restore token from local storage on load if user is logged in
    useEffect(() => {
        const token = localStorage.getItem('google_access_token');
        if (token) setAccessToken(token);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, accessToken, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

