import { defaultStudentRoute, getRouteServiceLabel, indusRoutes } from "./indusRoutes.js";
import { formatDateTime, formatShortDateTime, minutesAgo, relativeTimeLabel } from "../utils/dateLabels.js";

const route4 = defaultStudentRoute;
const selectedStop = route4.stops.find((stop) => stop.name === "Shilaj Circle");

export const initialStudentNotifications = [
    {
        id: "notif-1",
        type: "delay",
        title: `Traffic near ${selectedStop.name}`,
        message: "Your bus may be delayed by approximately 10 minutes.",
        createdAt: relativeTimeLabel(minutesAgo(2)),
        unread: true,
        routeCode: defaultStudentRoute.code,
    },
    {
        id: "notif-3",
        type: "general",
        title: "Transport help desk",
        message: "The campus transport office is available from 8 AM to 5 PM.",
        createdAt: formatShortDateTime(minutesAgo(24 * 60)),
        unread: false,
    },
];

export const initialNotificationCampaigns = [
    {
        id: "NTF-2026-0182",
        type: "delay",
        title: `Delay on Route ${route4.code}`,
        message: `Bus ${route4.primaryBusNumber} is running approximately 10 minutes late near ${selectedStop.name}.`,
        audience: "route",
        routeCode: route4.code,
        deliveryMode: "now",
        createdAt: formatShortDateTime(minutesAgo(18)),
        status: "delivered",
        deliveredCount: route4.studentCount,
        recipientCount: route4.studentCount,
        createdBy: "Admin Operator",
    },
    {
        id: "NTF-2026-0180",
        type: "general",
        title: "Evening service reminder",
        message: "Evening buses will depart from the Indus University main gate.",
        audience: "all",
        deliveryMode: "scheduled",
        scheduledFor: formatDateTime(new Date(Date.now() + 60 * 60 * 1000)),
        createdAt: formatShortDateTime(minutesAgo(2 * 24 * 60)),
        status: "scheduled",
        deliveredCount: 0,
        recipientCount: indusRoutes.reduce((sum, route) => sum + route.studentCount, 0),
        createdBy: "Admin Operator",
    },
];

export const initialComplaintCases = [
    {
        id: "CMP-2026-0445",
        studentId: "stu-2023",
        studentName: "Aarav Shah",
        studentEmail: "student@iite.indusuni.ac.in",
        category: "Delay",
        subject: "Pickup time mismatch",
        description: `The displayed pickup time was ${selectedStop.scheduledTime}, but the bus arrived after 8:30 AM without an alert.`,
        relatedService: getRouteServiceLabel(route4),
        routeCode: route4.code,
        busNumber: route4.primaryBusNumber,
        tripId: "TRIP-2108-IU-R4-AM",
        status: "new",
        assignedTo: "Unassigned",
        createdAt: "21 Aug 2026, 4:15 PM",
        updatedAt: "21 Aug 2026, 4:15 PM",
        timeline: [
            {
                id: "evt-445-1",
                title: "Complaint submitted",
                detail: "Student reported a pickup-time mismatch.",
                timestamp: "21 Aug, 4:15 PM",
            },
        ],
        internalNotes: [],
    },
    {
        id: "CMP-2026-0442",
        studentId: "stu-2023",
        studentName: "Aarav Shah",
        studentEmail: "student@iite.indusuni.ac.in",
        category: "Bus condition",
        subject: "Air conditioning needs attention",
        description: "Cooling was inconsistent during the afternoon trip and the rear section became uncomfortable.",
        relatedService: getRouteServiceLabel(route4),
        routeCode: route4.code,
        busNumber: route4.primaryBusNumber,
        tripId: "TRIP-1808-IU-R4-PM",
        status: "in-progress",
        assignedTo: "Fleet Maintenance",
        createdAt: "18 Aug 2026, 9:20 AM",
        updatedAt: "19 Aug 2026, 11:05 AM",
        timeline: [
            {
                id: "evt-442-1",
                title: "Complaint submitted",
                detail: "Bus condition issue reported.",
                timestamp: "18 Aug, 9:20 AM",
            },
            {
                id: "evt-442-2",
                title: "Assigned for review",
                detail: "Assigned to Fleet Maintenance.",
                timestamp: "19 Aug, 11:05 AM",
            },
        ],
        internalNotes: [
            {
                id: "note-442-1",
                author: "Operations Manager",
                message: "Inspect AC unit after the afternoon return trip.",
                createdAt: "19 Aug, 11:05 AM",
            },
        ],
    },
    {
        id: "CMP-2026-0412",
        studentId: "stu-2023",
        studentName: "Aarav Shah",
        studentEmail: "student@iite.indusuni.ac.in",
        category: "Delay",
        subject: "Morning bus arrived late",
        description: `The bus reached ${selectedStop.name} around 15 minutes after the displayed time.`,
        relatedService: getRouteServiceLabel(route4),
        routeCode: route4.code,
        busNumber: route4.primaryBusNumber,
        tripId: "TRIP-1208-IU-R4-AM",
        status: "resolved",
        assignedTo: "Operations Team",
        createdAt: "12 Aug 2026, 8:50 AM",
        updatedAt: "14 Aug 2026, 3:10 PM",
        resolution: "Traffic congestion was confirmed. The trip schedule has been adjusted by five minutes.",
        timeline: [
            {
                id: "evt-412-1",
                title: "Complaint submitted",
                detail: "Morning delay reported.",
                timestamp: "12 Aug, 8:50 AM",
            },
            {
                id: "evt-412-2",
                title: "Review completed",
                detail: "GPS and traffic data reviewed.",
                timestamp: "13 Aug, 2:30 PM",
            },
            {
                id: "evt-412-3",
                title: "Resolved",
                detail: "Resolution sent to the student.",
                timestamp: "14 Aug, 3:10 PM",
            },
        ],
        internalNotes: [
            {
                id: "note-412-1",
                author: "Admin Operator",
                message: `Recurring traffic confirmed near ${selectedStop.name}.`,
                createdAt: "13 Aug, 2:30 PM",
            },
        ],
    },
];

export const communicationRoutes = indusRoutes;
