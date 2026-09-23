import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchReminders, addReminder, updateReminder, deleteReminder, parseUTC, getUserRole } from '../api/client';

const speak = (text) => {
    if (Platform.OS === 'web' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new window.SpeechSynthesisUtterance(text);
        utt.lang = 'en-IN';
        utt.rate = 0.88;
        utt.pitch = 1.05;
        window.speechSynthesis.speak(utt);
    }
};

const showMsg = (title, msg) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${msg}`);
    } else {
        const { Alert } = require('react-native');
        Alert.alert(title, msg);
    }
};

export default function MedicationScreen({ navigation }) {
    const [reminders, setReminders] = useState([]);
    const [userRole, setUserRole]   = useState(null);
    const [title, setTitle]         = useState('Medication');
    const [notes, setNotes]         = useState('');
    const [timeStr, setTimeStr]     = useState('10:00 AM');
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading]     = useState(true);

    useEffect(() => {
        initialize();
    }, []);

    const initialize = async () => {
        try {
            const [user, data] = await Promise.all([getUserRole(), fetchReminders()]);
            setUserRole(user.role);
            setReminders(data);
        } catch (e) {
            console.error('Could not initialize medication screen', e);
        } finally {
            setLoading(false);
        }
    };

    const loadReminders = async () => {
        try {
            const data = await fetchReminders();
            setReminders(data);
        } catch (e) {
            console.error('Could not fetch reminders', e);
        }
    };

    const parseTimeStr = () => {
        let finalDate = new Date();
        if (timeStr.includes(':')) {
            try {
                const parts = timeStr.trim().split(' ');
                const [hourStr, minStr] = parts[0].split(':');
                const modifier = parts[1] ? parts[1].toUpperCase() : '';
                let hours = parseInt(hourStr, 10);
                const minutes = parseInt(minStr, 10);
                if (modifier === 'PM' && hours !== 12) hours += 12;
                if (modifier === 'AM' && hours === 12) hours = 0;
                finalDate.setHours(hours);
                finalDate.setMinutes(minutes);
                finalDate.setSeconds(0);
                finalDate.setMilliseconds(0);
            } catch (e) {}
        }
        return finalDate.toISOString();
    };

    const handleSave = async () => {
        if (!notes.trim()) {
            showMsg('Missing Info', 'Please add a description / medicine name.');
            return;
        }
        try {
            const fullTitle = `${title} - ${notes.trim()}`;
            if (editingId) {
                await updateReminder(editingId, fullTitle, parseTimeStr());
                showMsg('Updated', 'Schedule has been updated.');
            } else {
                await addReminder(fullTitle, parseTimeStr());
                showMsg('Saved', 'New medication schedule added.');
            }
            clearForm();
            loadReminders();
        } catch (e) {
            showMsg('Error', e?.response?.data?.detail || 'Could not save schedule.');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = Platform.OS === 'web'
            ? window.confirm('Delete this medication schedule?')
            : true;
        if (!confirmed) return;
        try {
            await deleteReminder(id);
            if (id === editingId) clearForm();
            loadReminders();
        } catch (e) {
            showMsg('Error', e?.response?.data?.detail || 'Could not delete schedule.');
        }
    };

    const clearForm = () => {
        setEditingId(null);
        setTitle('Medication');
        setNotes('');
        setTimeStr('10:00 AM');
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        const parts = item.title.split(' - ');
        setTitle(parts[0] || 'Medication');
        setNotes(parts.slice(1).join(' - ') || '');
        const itemDate = parseUTC(item.time);
        let h = itemDate.getHours();
        let m = itemDate.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        setTimeStr(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`);
    };

    const isPatient = userRole === 'Patient';

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.loadingText}>Loading medication schedules…</Text>
            </View>
        );
    }

    const handleToggleTaken = (item, medName) => {
        const newStatus = !item.is_completed;
        setReminders(prev => prev.map(r => r.id === item.id ? { ...r, is_completed: newStatus } : r));

        if (newStatus) {
            const spokenMsg = `Medication ${medName} marked as TAKEN. Care network updated.`;
            speak(spokenMsg);
            showMsg('✅ Medication Marked Taken', spokenMsg);
        } else {
            const spokenMsg = `Medication ${medName} marked as pending.`;
            speak(spokenMsg);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>Medication Schedules</Text>
                    <Text style={styles.headerSub}>{isPatient ? 'Daily Care Schedule' : 'Patient Medication Manager'}</Text>
                </View>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Patient Info Banner */}
                {isPatient && (
                    <View style={styles.infoBanner}>
                        <Ionicons name="information-circle" size={24} color="#2563eb" />
                        <Text style={styles.infoBannerText}>
                            Your daily medication is scheduled below. Tap any medicine when taken.
                        </Text>
                    </View>
                )}

                {/* Schedules List */}
                <Text style={styles.sectionTitle}>Active Medications & Schedule</Text>

                {reminders.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="medical-outline" size={44} color="#94a3b8" />
                        <Text style={styles.emptyText}>No medication schedules found.</Text>
                        {!isPatient && <Text style={styles.emptySubText}>Add the first schedule below.</Text>}
                    </View>
                ) : (
                    reminders.map(item => {
                        const dueTime = parseUTC(item.time);
                        const timeLabel = dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const parts = item.title.split(' - ');
                        const category = parts[0] || 'Medication';
                        const medName = parts.slice(1).join(' - ') || item.title;
                        return (
                            <View key={item.id} style={styles.reminderCard}>
                                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(category) }]}>
                                    <Ionicons name={getCategoryIcon(category)} size={22} color="white" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={styles.reminderTitle}>{medName}</Text>
                                    <Text style={styles.reminderCategory}>{category}</Text>
                                    <View style={styles.timeRow}>
                                        <Ionicons name="time-outline" size={15} color="#64748b" />
                                        <Text style={styles.reminderTime}> {timeLabel}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: item.is_completed ? '#16a34a' : '#ea580c' }
                                        ]}
                                        onPress={() => handleToggleTaken(item, medName)}
                                    >
                                        <Ionicons
                                            name={item.is_completed ? "checkmark-circle" : "time-outline"}
                                            size={18}
                                            color="white"
                                        />
                                        <Text style={styles.statusText}>
                                            {item.is_completed ? ' TAKEN ✓' : ' MARK AS TAKEN'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                {/* Caregiver/Doctor only actions */}
                                {!isPatient && (
                                    <View style={styles.actionCol}>
                                        <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
                                            <Ionicons name="pencil" size={16} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item.id)}>
                                            <Ionicons name="trash" size={16} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}

                {/* Add/Edit Form — CAREGIVER/DOCTOR ONLY */}
                {!isPatient && (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>{editingId ? '✏️ Edit Schedule' : '➕ Add New Schedule'}</Text>

                        <Text style={styles.label}>Category</Text>
                        <View style={styles.pillContainer}>
                            {['Medication', 'Lunch', 'Activity', 'Appointment'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.pill, title === t && styles.pillActive]}
                                    onPress={() => setTitle(t)}
                                >
                                    <Text style={[styles.pillText, title === t && styles.pillTextActive]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { marginTop: 16 }]}>Medicine / Description</Text>
                        <TextInput
                            style={styles.input}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="e.g. Donepezil 10mg — Take with warm water"
                            placeholderTextColor="#94a3b8"
                        />

                        <Text style={[styles.label, { marginTop: 16 }]}>Time (HH:MM AM/PM)</Text>
                        <TextInput
                            style={styles.timeInput}
                            value={timeStr}
                            onChangeText={setTimeStr}
                            placeholder="09:00 AM"
                            placeholderTextColor="#94a3b8"
                        />

                        <View style={styles.buttonRow}>
                            {editingId && (
                                <TouchableOpacity style={styles.cancelBtn} onPress={clearForm}>
                                    <Text style={styles.btnText}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Ionicons name={editingId ? 'checkmark-circle' : 'add-circle'} size={20} color="white" />
                                <Text style={[styles.btnText, { marginLeft: 6 }]}>{editingId ? 'Update' : 'Save Schedule'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const getCategoryColor = (cat) => {
    switch (cat) {
        case 'Medication': return '#2563eb';
        case 'Lunch': return '#ea580c';
        case 'Activity': return '#059669';
        case 'Appointment': return '#7c3aed';
        default: return '#64748b';
    }
};

const getCategoryIcon = (cat) => {
    switch (cat) {
        case 'Medication': return 'bandage';
        case 'Lunch': return 'restaurant';
        case 'Activity': return 'walk';
        case 'Appointment': return 'calendar';
        default: return 'ellipse';
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#64748b', fontSize: 16 },
    header: {
        height: 64,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
    headerSub: { fontSize: 12, color: '#64748b', textAlign: 'center' },
    content: { padding: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
    infoBanner: {
        backgroundColor: '#eff6ff',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    infoBannerText: { color: '#1e3a8a', fontSize: 13, flex: 1, marginLeft: 10, lineHeight: 18 },
    sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    emptyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    emptyText: { color: '#475569', fontSize: 15, marginTop: 10, fontWeight: '600' },
    emptySubText: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
    reminderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    categoryBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center'
    },
    reminderTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
    reminderCategory: { fontSize: 12, color: '#64748b', marginTop: 2 },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    reminderTime: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
    statusBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    statusText: { fontSize: 12, fontWeight: 'bold', color: 'white' },
    actionCol: { flexDirection: 'column', gap: 6, marginLeft: 10 },
    editBtn: {
        backgroundColor: '#f59e0b',
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    delBtn: {
        backgroundColor: '#ef4444',
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    formCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 20,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    formTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a', marginBottom: 14 },
    label: { fontSize: 13, color: '#475569', fontWeight: '600', marginBottom: 6 },
    pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    pillText: { color: '#475569', fontWeight: '600', fontSize: 13 },
    pillTextActive: { color: 'white' },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: '#0f172a'
    },
    timeInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    buttonRow: { flexDirection: 'row', marginTop: 18, gap: 10 },
    saveBtn: {
        backgroundColor: '#2563eb',
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center'
    },
    cancelBtn: {
        backgroundColor: '#94a3b8',
        flex: 0.4,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});
