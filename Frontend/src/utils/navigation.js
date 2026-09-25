export function permittedLoginDestination(requested, role) {
    const home = `/${role}`;
    if (typeof requested !== 'string' || !requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) return home;
    const destination = new URL(requested, 'https://smarttransit.invalid');
    const path = destination.pathname;
    return path === home || path.startsWith(`${home}/`) ? `${path}${destination.search}${destination.hash}` : home;
}

export const pageTitles = {
    '/': 'SmartTransit | Indus University Transport',
    '/login': 'Sign in', '/signin': 'Sign in', '/signup': 'Create student account',
    '/forgot-password': 'Reset password', '/help': 'Account and transport help',
    '/privacy': 'Privacy', '/unauthorized': 'Access unavailable',
    '/student': 'Student dashboard', '/student/track': 'Live Tracking', '/track': 'Live Tracking',
    '/student/routes': 'My route', '/student/alerts': 'Transport alerts', '/student/complaints': 'Complaints and feedback',
    '/student/profile': 'Student profile', '/student/help': 'Transport help',
    '/driver': 'Driver dashboard', '/driver/checklist': 'Pre-trip checklist', '/driver/trip': 'Active trip',
    '/driver/emergency': 'Emergency report', '/driver/history': 'Trip history', '/driver/profile': 'Driver profile',
    '/conductor': 'Conductor dashboard', '/conductor/trip': 'Seat updates', '/conductor/emergency': 'Emergency report',
    '/conductor/history': 'Passenger update history', '/conductor/profile': 'Conductor profile',
    '/admin': 'Transport overview', '/admin/live': 'Live operations', '/admin/simulator': 'GPS simulator',
    '/admin/buses': 'Buses', '/admin/routes': 'Routes', '/admin/stops': 'Stops', '/admin/drivers': 'Drivers',
    '/admin/conductors': 'Conductors', '/admin/students': 'Student management', '/admin/assignments': 'Assignments',
    '/admin/notifications': 'Notifications', '/admin/complaints': 'Complaint management', '/admin/reports': 'Reports',
    '/admin/settings': 'Settings', '/admin/settings/states': 'System states', '/admin/search': 'Search',
};

export function pageMetadata(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    const title = pageTitles[path] ?? 'Page not found';
    const publicPage = ['/', '/help', '/privacy'].includes(path);
    return { title: path === '/' ? title : `${title} | SmartTransit`, robots: publicPage ? 'index,follow' : 'noindex,nofollow', canonical: publicPage ? `https://smart-transit-lyart.vercel.app${path}` : null };
}
