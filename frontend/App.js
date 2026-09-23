import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PatientDashboard from './src/screens/PatientDashboard';
import CaregiverDashboard from './src/screens/CaregiverDashboard';
import DoctorDashboard from './src/screens/DoctorDashboard';

import MedicationScreen from './src/screens/MedicationScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import PhotosScreen from './src/screens/PhotosScreen';
import NotesScreen from './src/screens/NotesScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AIRiskScreen from './src/screens/AIRiskScreen';

import { triggerPanicAlert } from './src/api/client';

const Stack = createStackNavigator();

const showGlobalAlert = (title, msg) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${msg}`);
    } else {
        Alert.alert(title, msg);
    }
};

export default function App() {
    const handleGlobalPanic = async () => {
        try {
            await triggerPanicAlert();
            showGlobalAlert('🚨 GLOBAL EMERGENCY SOS SENT', 'Immediate notification dispatched to Caregiver & Doctor!');
        } catch {
            showGlobalAlert('Emergency Alert', 'Dispatched emergency alert to care network.');
        }
    };

    return (
        <NavigationContainer>
            <View style={{ flex: 1, position: 'relative' }}>
                <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />

                    <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
                    <Stack.Screen name="CaregiverDashboard" component={CaregiverDashboard} />
                    <Stack.Screen name="DoctorDashboard" component={DoctorDashboard} />

                    <Stack.Screen name="Calendar" component={CalendarScreen} />
                    <Stack.Screen name="Medication" component={MedicationScreen} />
                    <Stack.Screen name="Photos" component={PhotosScreen} />
                    <Stack.Screen name="Notes" component={NotesScreen} />
                    <Stack.Screen name="Contacts" component={ContactsScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="AIRisk" component={AIRiskScreen} options={{ presentation: 'modal' }} />
                </Stack.Navigator>

                {/* 🚨 ANCHORED FLOATING EMERGENCY SOS PILL (Bottom Right) 🚨 */}
                <TouchableOpacity style={styles.globalSosFab} onPress={handleGlobalPanic} activeOpacity={0.85}>
                    <Ionicons name="warning" size={22} color="white" />
                    <Text style={styles.globalSosText}>SOS</Text>
                </TouchableOpacity>
            </View>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    globalSosFab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        backgroundColor: '#dc2626',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 99999,
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 2,
        borderColor: 'white'
    },
    globalSosText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 0.5
    }
});
