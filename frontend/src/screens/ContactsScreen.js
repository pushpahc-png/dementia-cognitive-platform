import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchContacts, addContact } from '../api/client';

export default function ContactsScreen({ navigation }) {
    const [contacts, setContacts] = useState([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        try {
            const data = await fetchContacts();
            setContacts(data);
        } catch (e) {
            console.log(e);
        }
    };

    const handleAdd = async () => {
        if (!name.trim() || !phone.trim()) return;
        try {
            await addContact(name.trim(), phone.trim());
            setName('');
            setPhone('');
            loadContacts();
            if (Platform.OS === 'web') window.alert('Contact saved successfully!');
            else Alert.alert('Success', 'Contact saved successfully!');
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Care Network & Contacts</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.addForm}>
                    <Text style={styles.formTitle}>Add New Caregiver / Contact</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Full Name (e.g. Spandana / Lakshmi K R)" 
                        placeholderTextColor="#94a3b8"
                        value={name} 
                        onChangeText={setName}
                    />
                    <TextInput 
                        style={styles.input} 
                        placeholder="Phone Number (e.g. +91 9876543210)" 
                        placeholderTextColor="#94a3b8"
                        value={phone} 
                        onChangeText={setPhone} 
                        keyboardType="phone-pad"
                    />
                    <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                        <Text style={styles.addButtonText}>Save Contact</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={contacts}
                    keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.contactCard}>
                            <View style={styles.avatarCircle}>
                                <Ionicons name="person" size={22} color="#2563eb" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.contactName}>{item.name}</Text>
                                <Text style={styles.contactPhone}>{item.phone}</Text>
                            </View>
                            <TouchableOpacity 
                                style={styles.callButton}
                                onPress={() => {
                                    if (Platform.OS === 'web') window.alert(`Calling ${item.name} at ${item.phone}...`);
                                    else Alert.alert('Calling', `Connecting to ${item.name} (${item.phone})...`);
                                }}
                            >
                                <Ionicons name="call" size={18} color="#16a34a" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        height: 64,
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    content: { flex: 1, padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center' },
    addForm: {
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    formTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 14,
        marginBottom: 10,
        backgroundColor: '#f8fafc',
        fontSize: 14,
        color: '#0f172a'
    },
    addButton: {
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 4
    },
    addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    contactCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    contactName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
    contactPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
    callButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#dcfce7',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
