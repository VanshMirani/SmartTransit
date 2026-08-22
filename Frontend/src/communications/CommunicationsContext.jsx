/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, } from "react";
import { useAuth } from "../auth/AuthContext";
import { initialComplaintCases, initialNotificationCampaigns, initialStudentNotifications, } from "../services/communicationsData";
import { apiRequest, backendConfig } from "../services/apiClient";
import { defaultStudentRoute, indusRoutes } from "../services/indusRoutes";
const CommunicationsContext = createContext(null);
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const totalStudentCount = indusRoutes.reduce((sum, route) => sum + route.studentCount, 0);
const findRoute = (routeCode) => indusRoutes.find((route) => route.code === routeCode);
const findRouteFromService = (service) => indusRoutes.find((route) => service.includes(route.code));
const nowLabel = () => new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
}).format(new Date());
export function CommunicationsProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id;
    const [notifications, setNotifications] = useState(initialStudentNotifications);
    const [campaigns, setCampaigns] = useState(initialNotificationCampaigns);
    const [complaints, setComplaints] = useState(initialComplaintCases);
    useEffect(() => {
        if (!backendConfig.enabled) {
            return;
        }
        if (!userId) {
            setNotifications(initialStudentNotifications);
            setCampaigns(initialNotificationCampaigns);
            setComplaints(initialComplaintCases);
            return;
        }
        let cancelled = false;
        apiRequest("/communications/bootstrap")
            .then((data) => {
            if (cancelled) {
                return;
            }
            setNotifications(data.notifications ?? initialStudentNotifications);
            setCampaigns(data.campaigns ?? initialNotificationCampaigns);
            setComplaints(data.complaints ?? initialComplaintCases);
        })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [userId]);
    const value = useMemo(() => ({
        notifications,
        campaigns,
        complaints,
        unreadCount: notifications.filter((item) => item.unread).length,
        sendNotification: async (input) => {
            if (backendConfig.enabled) {
                const campaign = await apiRequest("/admin/notifications", { method: "POST", body: input });
                setCampaigns((items) => [campaign, ...items]);
                return campaign;
            }

            await wait(550);
            const id = `NTF-${new Date().getFullYear()}-${String(campaigns.length + 183).padStart(4, "0")}`;
            const route = findRoute(input.routeCode);
            const recipientCount = input.audience === "all"
                ? totalStudentCount
                : route?.studentCount ?? 0;
            const campaign = {
                ...input,
                id,
                createdAt: nowLabel(),
                status: input.deliveryMode === "scheduled" ? "scheduled" : "delivered",
                deliveredCount: input.deliveryMode === "scheduled" ? 0 : recipientCount,
                recipientCount,
                createdBy: "Admin Operator",
            };
            setCampaigns((items) => [campaign, ...items]);
            if (campaign.status === "delivered" &&
                (campaign.audience === "all" || campaign.routeCode === defaultStudentRoute.code)) {
                setNotifications((items) => [
                    {
                        id: campaign.id,
                        type: campaign.type,
                        title: campaign.title,
                        message: campaign.message,
                        createdAt: "Just now",
                        unread: true,
                        routeCode: campaign.routeCode,
                    },
                    ...items,
                ]);
            }
            return campaign;
        },
        markAllNotificationsRead: () => setNotifications((items) => items.map((item) => ({ ...item, unread: false }))),
        createComplaint: async (input) => {
            if (backendConfig.enabled) {
                const complaint = await apiRequest("/student/complaints", { method: "POST", body: input });
                setComplaints((items) => [complaint, ...items]);
                return complaint;
            }

            await wait(650);
            const label = nowLabel();
            const route = findRouteFromService(input.relatedService);
            const complaint = {
                ...input,
                id: `CMP-${new Date().getFullYear()}-${String(complaints.length + 446).padStart(4, "0")}`,
                studentId: "stu-2023",
                studentName: "Aarav Shah",
                studentEmail: "student@iite.indusuni.ac.in",
                routeCode: route?.code ?? "Not linked",
                busNumber: route?.primaryBusNumber ?? "Not linked",
                tripId: route ? `TRIP-CURRENT-${route.code}` : "Not linked",
                status: "new",
                assignedTo: "Unassigned",
                createdAt: label,
                updatedAt: label,
                timeline: [
                    {
                        id: `evt-${Date.now()}`,
                        title: "Complaint submitted",
                        detail: "Submitted through the student application.",
                        timestamp: label,
                    },
                ],
                internalNotes: [],
            };
            setComplaints((items) => [complaint, ...items]);
            return complaint;
        },
        updateComplaint: async (input) => {
            if (backendConfig.enabled) {
                const updated = await apiRequest(`/admin/complaints/${input.id}`, { method: "PATCH", body: input });
                setComplaints((items) => items.map((item) => item.id === updated.id ? updated : item));
                return updated;
            }

            await wait(450);
            const label = nowLabel();
            const current = complaints.find((item) => item.id === input.id);
            if (!current)
                throw new Error("Complaint not found.");
            const statusChanged = current.status !== input.status;
            const assignmentChanged = current.assignedTo !== input.assignedTo;
            const updated = {
                ...current,
                status: input.status,
                assignedTo: input.assignedTo,
                resolution: input.resolution?.trim() || current.resolution,
                updatedAt: label,
                internalNotes: input.internalNote?.trim()
                    ? [
                        ...current.internalNotes,
                        {
                            id: `note-${Date.now()}`,
                            author: "Admin Operator",
                            message: input.internalNote.trim(),
                            createdAt: label,
                        },
                    ]
                    : current.internalNotes,
                timeline: [
                    ...current.timeline,
                    ...(assignmentChanged
                        ? [
                            {
                                id: `evt-assign-${Date.now()}`,
                                title: "Assignment updated",
                                detail: `Assigned to ${input.assignedTo}.`,
                                timestamp: label,
                            },
                        ]
                        : []),
                    ...(statusChanged
                        ? [
                            {
                                id: `evt-status-${Date.now()}`,
                                title: input.status === "resolved"
                                    ? "Resolved"
                                    : "Status updated",
                                detail: `Complaint moved to ${input.status.replace("-", " ")}.`,
                                timestamp: label,
                            },
                        ]
                        : []),
                ],
            };
            setComplaints((items) => items.map((item) => (item.id === input.id ? updated : item)));
            return updated;
        },
    }), [campaigns, complaints, notifications]);
    return (<CommunicationsContext.Provider value={value}>
      {children}
    </CommunicationsContext.Provider>);
}
export function useCommunications() {
    const value = useContext(CommunicationsContext);
    if (!value)
        throw new Error("useCommunications must be used inside CommunicationsProvider");
    return value;
}
