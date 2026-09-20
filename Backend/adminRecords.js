const text = (value) => String(value ?? '').trim();
const email = (value) => text(value).toLowerCase();
const routeStates = (data) => [data.operations, ...Object.values(data.operations?.routeTrips ?? {})].filter(Boolean);
const activeRoute = (data, code) => routeStates(data).some((state) => state.tripStatus === 'active' && state.activeStaffTrip?.routeCode === code);
const assignmentKey = { buses: 'busId', drivers: 'driverId', conductors: 'conductorId' };

export function validateManagedRecord(data, kind, record, previous) {
    if (!text(record.id) || text(record.id).length > 128 || !text(record.name) || !text(record.code))
        return 'A record ID, name and code are required.';
    if ([record.name, record.code, record.detail, record.contact, record.assignment].some((value) => typeof value !== 'string' || value.length > 500))
        return 'Record fields must be text of at most 500 characters.';
    const statuses = kind === 'students' ? ['active', 'inactive', 'pending', 'rejected'] : kind === 'buses' ? ['active', 'inactive', 'maintenance'] : ['active', 'inactive'];
    if (!statuses.includes(record.status)) return 'Choose a valid record status.';
    const others = data.admin.records[kind].filter((item) => item.id !== record.id);
    if (others.some((item) => email(item.code) === email(record.code))) return 'This record code already exists.';
    if (kind === 'buses' && (!/^\d+\s*(seats?)?$/i.test(text(record.contact)) || !Number.isInteger(Number.parseInt(record.contact)) || Number.parseInt(record.contact) < 1 || Number.parseInt(record.contact) > 200))
        return 'Enter a whole bus capacity between 1 and 200 seats.';
    if (kind === 'students' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email(record.contact)) || others.some((item) => email(item.contact) === email(record.contact))))
        return 'Enter a valid, unique student email address.';
    if (kind === 'drivers' || kind === 'conductors') {
        if (record.accountEmail && others.some((item) => email(item.accountEmail) === email(record.accountEmail))) return 'This staff login already belongs to another record.';
        if (previous?.accountUserId && record.accountUserId !== previous.accountUserId) return 'The linked staff account cannot be replaced.';
        if (!previous && record.accountUserId) return 'A new staff record cannot claim an existing account ID.';
        const existingUser = data.users.find((item) => email(item.email) === email(record.accountEmail));
        if (existingUser && (!previous || (previous.accountUserId ? previous.accountUserId !== existingUser.id : email(previous.accountEmail) !== email(existingUser.email)))) return 'This email already belongs to an account. Edit its existing staff record.';
    }
    const key = assignmentKey[kind];
    if (previous && key && data.admin.routes.some((route) => route[key] === record.id && activeRoute(data, route.code))) {
        if (['name', 'code', 'contact', 'status', 'accountEmail', 'accountUserId'].some((field) => text(previous[field]) !== text(record[field])) || record.temporaryPassword)
            return 'End the active trip before changing this assigned record or account.';
    }
    return '';
}

export function validateManagedRoute(data, route, previous) {
    if (![route.id, route.code, route.name, route.startPoint, route.destination].every((value) => typeof value === 'string' && value.trim() && value.length <= 200))
        return 'A route ID, code, name, start point and destination are required.';
    if (!/^IU-R\d+$/i.test(route.code)) return 'Use a route code such as IU-R9.';
    if (!['active', 'inactive'].includes(route.status)) return 'Choose an active or inactive route status.';
    if (data.admin.routes.some((item) => item.id !== route.id && email(item.code) === email(route.code))) return 'This route code already exists.';
    if (previous && previous.code !== route.code) return 'The route code cannot change after creation. Create a new route instead.';
    if (!Array.isArray(route.stops) || route.stops.length < 2 || route.stops.length > 100) return 'Add between 2 and 100 ordered stops.';
    if (route.stops.some((stop) => !stop || typeof stop.id !== 'string' || !stop.id.trim() || typeof stop.name !== 'string' || !stop.name.trim() || typeof stop.scheduledTime !== 'string' || !stop.scheduledTime.trim()))
        return 'Every stop needs an ID, name and scheduled time.';
    if (new Set(route.stops.map((stop) => stop.id)).size !== route.stops.length) return 'Each stop in a route needs a unique ID.';
    if (previous && activeRoute(data, previous.code)) return 'End the active trip before editing or deactivating this route.';
    for (const [kind, key] of Object.entries(assignmentKey)) {
        if (!route[key]) continue;
        const record = data.admin.records[kind].find((item) => item.id === route[key]);
        if (!record) return `The selected ${kind} record no longer exists.`;
        if (record.status !== 'active' && previous?.[key] !== route[key]) return `Choose an active ${kind} record.`;
        const conflict = data.admin.routes.find((item) => item.id !== route.id && item.status === 'active' && item[key] === route[key]);
        if (route.status === 'active' && conflict) return `This ${kind} assignment is already used by ${conflict.code}. Unassign it there first.`;
    }
    const affectedStudent = data.admin.records.students.some((student) => student.routeCode === route.code && student.stopId && !route.stops.some((stop) => stop.id === student.stopId));
    if (affectedStudent) return 'Reassign students from a stop before removing that stop.';
    return '';
}

export function deleteManagedRecord(data, kind, id) {
    const collection = kind === 'routes' ? data.admin.routes : data.admin.records[kind];
    const record = collection?.find((item) => item.id === id);
    if (!record) return { ok: true, alreadyDeleted: true };
    if (kind === 'routes') {
        if (activeRoute(data, record.code)) return { error: 'End the active trip before deleting this route.' };
        if (data.admin.records.students.some((student) => student.routeCode === record.code || text(student.assignment).startsWith(`${record.code} -`)) || data.users.some((user) => user.role === 'student' && user.routeCode === record.code))
            return { error: 'Reassign the students before deleting this route.' };
        if ((data.operations.tripHistory ?? []).some((trip) => trip.routeCode === record.code))
            return { error: 'This route has trip history. Deactivate it to preserve the transport records.' };
        if (record.busId || record.driverId || record.conductorId) return { error: 'Unassign the bus, driver and conductor in the route editor before deleting this route.' };
        data.admin.routes = collection.filter((item) => item.id !== id);
        data.admin.deletedRouteCodes = [...new Set([...(data.admin.deletedRouteCodes ?? []), record.code])];
        data.admin.fleetVehicles = data.admin.fleetVehicles.filter((bus) => bus.route !== record.code);
        delete data.operations.routeTrips?.[record.code];
        for (const [tripId, location] of Object.entries(data.operations.liveLocations ?? {}))
            if (location.routeCode === record.code) delete data.operations.liveLocations[tripId];
        if (data.operations.activeStaffTrip?.routeCode === record.code) {
            data.operations.activeStaffTrip = null;
            data.operations.operationalStops = [];
            data.operations.tripStatus = 'not-started';
        }
    } else {
        const key = assignmentKey[kind];
        if (key && data.admin.routes.some((route) => route[key] === id)) return { error: 'Unassign this record from its route before deleting it.' };
        const role = kind === 'students' ? 'student' : kind === 'drivers' ? 'driver' : kind === 'conductors' ? 'conductor' : null;
        const linkedUsers = role ? data.users.filter((user) => user.role === role && (user.id === record.accountUserId || user.id === id || email(user.email) === email(kind === 'students' ? record.contact : record.accountEmail))) : [];
        const userIds = new Set(linkedUsers.map((user) => user.id));
        if ((data.operations.tripHistory ?? []).some((trip) => userIds.has(trip.driverUserId) || userIds.has(trip.conductorUserId) || (kind === 'buses' && trip.busNumber === record.name)))
            return { error: 'This record has trip history. Deactivate it instead.' };
        if ((data.communications.complaints ?? []).some((item) => userIds.has(item.studentId))) return { error: 'This student has complaint history. Deactivate the account instead.' };
        data.admin.records[kind] = collection.filter((item) => item.id !== id);
        data.users = data.users.filter((user) => !userIds.has(user.id));
        for (const [token, session] of Object.entries(data.sessions)) if (userIds.has(session.userId)) delete data.sessions[token];
        for (const user of linkedUsers) {
            delete data.signupOtps?.[email(user.email)];
            delete data.passwordResetOtps?.[email(user.email)];
        }
        if (kind === 'buses') data.admin.fleetVehicles = data.admin.fleetVehicles.filter((bus) => bus.id !== id && bus.number !== record.name);
    }
    return { ok: true };
}
