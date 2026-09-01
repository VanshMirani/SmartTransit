import { initialComplaints, studentTransitData } from './mockData';
import { apiRequest, backendConfig } from './apiClient';
import { relativeTimeLabel } from '../utils/dateLabels';
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
let complaints = [...initialComplaints];
export const studentService = {
    async getTransitData() {
        if (backendConfig.enabled)
            return apiRequest('/student/transit');

        await wait(260);
        return studentTransitData;
    },
    async getComplaints() {
        if (backendConfig.enabled)
            return apiRequest('/student/complaints');

        await wait(250);
        return [...complaints];
    },
    async createComplaint(input) {
        if (backendConfig.enabled)
            return apiRequest('/student/complaints', { method: 'POST', body: input });

        await wait(650);
        const now = new Date();
        const complaint = {
            ...input,
            id: `CMP-${now.getFullYear()}-${String(complaints.length + 443).padStart(4, '0')}`,
            status: 'new',
            createdAt: relativeTimeLabel(now.toISOString()),
            updatedAt: relativeTimeLabel(now.toISOString()),
        };
        complaints = [complaint, ...complaints];
        return complaint;
    },
};
