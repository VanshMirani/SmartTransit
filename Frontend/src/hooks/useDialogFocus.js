import { useEffect, useRef } from 'react';

export function useDialogFocus(open, close) {
    const ref = useRef(null);
    const onClose = useRef(close);
    onClose.current = close;
    useEffect(() => {
        if (!open || !ref.current) return undefined;
        const dialog = ref.current;
        const previous = document.activeElement;
        const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length);
        const focusFirst = () => (focusable()[0] ?? dialog).focus();
        focusFirst();
        const focusIn = (event) => { if (!dialog.contains(event.target)) focusFirst(); };
        const keydown = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose.current(); }
            if (event.key !== 'Tab') return;
            const items = focusable();
            if (!items.length) { event.preventDefault(); dialog.focus(); }
            else if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
        };
        document.addEventListener('focusin', focusIn);
        dialog.addEventListener('keydown', keydown);
        return () => {
            document.removeEventListener('focusin', focusIn);
            dialog.removeEventListener('keydown', keydown);
            if (previous?.isConnected) previous.focus();
        };
    }, [open]);
    return ref;
}
