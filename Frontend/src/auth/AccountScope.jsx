import { Fragment } from 'react';
import { useAuth } from './AuthContext';

export function AccountScope({ children }) {
    const { user } = useAuth();
    // Remount account-specific providers so cached records never cross sign-ins.
    return <Fragment key={user ? `${user.id}:${user.role}` : 'signed-out'}>{children}</Fragment>;
}
