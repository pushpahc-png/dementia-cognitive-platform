import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotes, addNote } from '../api/client';

export default function NotesScreen({ navigation }) {
    const [notes, setNotes] = useState([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    useEffect(() => {
        loadNotes();
    }, []);

    const loadNotes = async () => {
        try {
            const data = await fetchNotes();
            setNotes(data);
        } catch (error) {
            console.error('Failed to load notes', error);
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) return;
        try {
            await addNote(title.trim(), content.trim());
            setTitle('');
            setContent('');
            loadNotes();
            if (Platform.OS === 'web') window.alert('Note saved successfully!');
            else Alert.alert("Success", "Note saved.");
        } catch (error) {
            Alert.alert("Error", "Could not save note.");
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Care Journal & Notes</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.inputContainer}>
                    <Text style={styles.inputHeading}>New Behavioral / Memory Note</Text>
                    <TextInput 
                        style={styles.inputTitle} 
                        placeholder="Note Title (e.g. Afternoon orientation behavior)" 
                        placeholderTextColor="#94a3b8"
                        value={title} 
                        onChangeText={setTitle} 
                    />
                    <TextInput 
                        style={styles.inputContent} 
                        placeholder="Write observations, caregiver reminders, or daily health updates..." 
                        placeholderTextColor="#94a3b8"
                        multiline
                        value={content} 
                        onChangeText={setContent} 
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>Save Entry</Text>
                    </TouchableOpacity>
                </View>
                
                <FlatList
                    data={notes}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1, marginTop: 10 }}
                    renderItem={({ item }) => (
                        <View style={styles.noteCard}>
                            <View style={styles.noteHeader}>
                                <Ionicons name="document-text-outline" size={18} color="#2563eb" />
                                <Text style={styles.noteTitle}>{item.title}</Text>
                            </View>
                            <Text style={styles.noteDesc}>{item.content}</Text>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 30 }}>
                            No notes logged yet. Add your first care journal entry above.
                        </Text>
                    }
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        height: 64,
        paddingHorizontal: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    content: { flex: 1, padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center' },
    inputContainer: {
        backgroundColor: 'white',
        padding: 18,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    inputHeading: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
    inputTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        backgroundColor: '#f8fafc',
        color: '#0f172a'
    },
    inputContent: {
        minHeight: 70,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        textAlignVertical: 'top'
    },
    saveBtn: {
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 12
    },
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    noteCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    noteTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1 },
    noteDesc: { fontSize: 13, color: '#475569', lineHeight: 18 }
});
