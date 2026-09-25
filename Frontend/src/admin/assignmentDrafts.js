export function mergeAssignmentDrafts(routes, drafts, dirtyIds) {
    return Object.fromEntries(routes.map((route) => [route.id, dirtyIds.has(route.id) && drafts[route.id]
        ? drafts[route.id]
        : { busId: route.busId ?? '', driverId: route.driverId ?? '', conductorId: route.conductorId ?? '', ...(route._version ? { _version: route._version } : {}) }]));
}
