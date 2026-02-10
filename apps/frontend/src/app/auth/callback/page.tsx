'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LoadingOverlay } from '@/components/ui/loading';
import toast from 'react-hot-toast';

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setAuth } = useAuthStore();

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const refreshToken = searchParams.get('refreshToken');
            const error = searchParams.get('error');

            if (error) {
                toast.error('Authentication failed. Please try again.');
                router.push('/login');
                return;
            }

            if (token && refreshToken) {
                try {
                    // Store tokens
                    localStorage.setItem('token', token);
                    localStorage.setItem('refreshToken', refreshToken);

                    // Fetch user profile
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setAuth(data.user, token, refreshToken);

                        toast.success('Successfully signed in with Google!');

                        // Redirect based on role
                        if (data.user.role === 'admin') {
                            router.push('/admin');
                        } else {
                            router.push('/dashboard/daily');
                        }
                    } else {
                        throw new Error('Failed to fetch user profile');
                    }
                } catch (error) {
                    console.error('Auth callback error:', error);
                    toast.error('Authentication failed. Please try again.');
                    router.push('/login');
                }
            } else {
                toast.error('Invalid authentication response');
                router.push('/login');
            }
        };

        handleCallback();
    }, [searchParams, router, setAuth]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <LoadingOverlay isVisible={true} text="Completing sign in..." />
        </div>
    );
}
