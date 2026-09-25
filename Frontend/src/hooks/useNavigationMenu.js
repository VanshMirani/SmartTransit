import { useEffect, useRef, useState } from 'react';

export function useNavigationMenu() {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const navigationRef = useRef(null);
    const close = () => { setOpen(false); triggerRef.current?.focus(); };
    useEffect(() => {
        if (!open) return;
        navigationRef.current?.querySelector('a, button')?.focus();
        const escape = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [open]);
    return { open, setOpen, close, triggerRef, navigationRef };
}
