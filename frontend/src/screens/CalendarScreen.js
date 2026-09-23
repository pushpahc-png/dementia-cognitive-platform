import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchReminders, parseUTC } from '../api/client';

export default function CalendarScreen({ navigation }) {
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            const data = await fetchReminders();
            const sorted = data.sort((a, b) => parseUTC(a.time).getTime() - parseUTC(b.time).getTime());
            setTasks(sorted);
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Daily Outlook & Schedule</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.subtitle}>Today's Timeline</Text>
                    <FlatList
                        data={tasks}
                        keyExtractor={(item) => item.id.toString()}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item, index }) => (
                            <View style={styles.timelineRow}>
                                {/* Timeline Column */}
                                <View style={styles.timeColumn}>
                                    <Text style={styles.timeText}>{parseUTC(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>

                                {/* Mapping line */}
                                <View style={styles.lineColumn}>
                                    <View style={[styles.dot, item.is_completed && styles.dotCompleted]} />
                                    {index !== tasks.length - 1 && <View style={styles.line} />}
                                </View>

                                {/* Agenda Card */}
                                <View style={[styles.agendaCard, item.is_completed && styles.agendaCompleted]}>
                                    <Text style={[styles.agendaTitle, item.is_completed && styles.agendaTitleCompleted]}>{item.title}</Text>
                                    <Text style={styles.agendaStatus}>{item.is_completed ? '✅ Completed' : '⏰ Scheduled'}</Text>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#94a3b8' }}>Looks like a free day!</Text>}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
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
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    content: { flex: 1, padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center' },
    card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, flex: 1, borderWidth: 1, borderColor: '#e2e8f0' },
    subtitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 18 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
    timeColumn: { width: 75, alignItems: 'center', paddingTop: 10 },
    timeText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    lineColumn: { width: 30, alignItems: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#cbd5e1', zIndex: 10, marginTop: 12 },
    dotCompleted: { backgroundColor: '#2563eb' },
    line: { width: 2, height: '100%', backgroundColor: '#f1f5f9', position: 'absolute', top: 20, bottom: 0 },
    agendaCard: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 14, marginLeft: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    agendaCompleted: { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' },
    agendaTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    agendaTitleCompleted: { textDecorationLine: 'line-through', color: '#64748b' },
    agendaStatus: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '500' }
});
