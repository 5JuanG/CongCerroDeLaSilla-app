
interface Assignment {
    id: string;
    date: string;
    createdAt?: string;
    completedDate?: string;
}

const dailyAssignments: Assignment[] = [
    { id: '1', date: '2024-01-01', completedDate: '2024-01-01' },
    { id: '2', date: '2024-01-02', completedDate: '2024-01-02' },
    { id: '3', date: '2024-01-03', completedDate: '2024-01-03' },
    { id: '4', date: '2024-01-04', completedDate: '' } // Pending
];

const displayedAssignments = (() => {
    const sorted = [...dailyAssignments].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const latestId = sorted[0]?.id;
    console.log('Latest ID:', latestId);

    return sorted.filter(a => {
        const isCompleted = !!a.completedDate;
        const isLatest = a.id === latestId;
        const keep = !isCompleted || isLatest;
        console.log(`ID: ${a.id}, Date: ${a.date}, Completed: ${isCompleted}, IsLatest: ${isLatest} -> Keep: ${keep}`);
        return keep;
    });
})();

console.log('Result:', displayedAssignments);
