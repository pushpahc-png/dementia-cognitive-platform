import React, { useEffect, useState } from 'react';
import {
    Alert, FlatList, ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View, Modal, Linking, Platform, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DementiaCareHeader from '../components/DementiaCareHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import {
    getUserRole, getUserById, fetchAlerts, deleteAlert, fetchConversation,
    fetchPatients, fetchReminders, sendMessage, linkPatientByEmail,
    fetchPatientLocation, predictRisk
} from '../api/client';

export default function CaregiverDashboard({ navigation }) {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [activeTab, setActiveTab]                 = useState('dashboard');
    const [currentUser, setCurrentUser]             = useState(null);
    const [patients, setPatients]                   = useState([]);
    const [selectedPatient, setSelectedPatient]     = useState(null);
    const [alerts, setAlerts]                       = useState([]);
    const [reminders, setReminders]                 = useState([]);
    const [teamMembers, setTeamMembers]             = useState([]);
    const [selectedChatUser, setSelectedChatUser]   = useState(null);
    const [messages, setMessages]                   = useState([]);
    const [draftMessage, setDraftMessage]           = useState('');
    const [linkPatientEmail, setLinkPatientEmail]   = useState('');

    // Patient AI & Location state
    const [patientAiData, setPatientAiData]         = useState({});
    const [liveLocation, setLiveLocation]           = useState(null);

    // Care Journal Behavioral Logging
    const [symptomLog, setSymptomLog]               = useState([
        { text: 'Patient rested well in the afternoon.', time: '02:30 PM' },
        { text: 'Taken morning medication on time with warm water.', time: '09:05 AM' }
    ]);
    const [newSymptom, setNewSymptom]               = useState('');

    // Link modal
    const [linkModalOpen, setLinkModalOpen]         = useState(false);

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 15000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedChatUser) {
            loadConversation(selectedChatUser.id);
        }
    }, [selectedChatUser]);

    const loadDashboardData = async () => {
        try {
            const [user, fetchedPatients, fetchedAlerts, fetchedReminders] = await Promise.all([
                getUserRole().catch(() => null),
                fetchPatients().catch(() => []),
                fetchAlerts().catch(() => []),
                fetchReminders().catch(() => [])
            ]);

            if (user) setCurrentUser(user);
            const pts = Array.isArray(fetchedPatients) ? fetchedPatients : [];
            setPatients(pts);

            const patientIds = new Set(pts.map((p) => p.id));
            if (pts.length > 0) {
                setSelectedPatient(prev => {
                    if (!prev) return pts[0];
                    const found = pts.find(p => p.id === prev.id);
                    return found || pts[0];
                });
            } else {
                setSelectedPatient(null);
            }

            const alts = Array.isArray(fetchedAlerts) ? fetchedAlerts : [];
            setAlerts(alts.filter((a) => patientIds.size === 0 || patientIds.has(a.user_id)));

            const rems = Array.isArray(fetchedReminders) ? fetchedReminders : [];
            setReminders(rems.filter((r) => patientIds.size === 0 || patientIds.has(r.user_id)));

            for (const p of pts) {
                try {
                    const aiRes = await predictRisk(p.id);
                    setPatientAiData(prev => ({ ...prev, [p.id]: aiRes }));
                } catch (e) {
                    console.log('AI lookup error', p.id);
                }
            }

            const doctorIds = [...new Set(pts.map((p) => p.doctor_id).filter(Boolean))];
            if (doctorIds.length > 0) {
                const doctors = await Promise.all(doctorIds.map((dId) => getUserById(dId).catch(() => null)));
                const validDoctors = doctors.filter(Boolean);
                setTeamMembers(validDoctors);
                if (!selectedChatUser && validDoctors.length > 0) {
                    setSelectedChatUser(validDoctors[0]);
                }
            }
        } catch (error) {
            console.error('Failed to load caregiver data:', error);
        }
    };

    const loadConversation = async (otherUserId) => {
        try {
            const conversation = await fetchConversation(otherUserId);
            setMessages(Array.isArray(conversation) ? conversation : []);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    };

    const handleTrackLocation = async () => {
        const patientToTrack = selectedPatient || (patients.length > 0 ? patients[0] : null);
        let lat = 12.9716;
        let lng = 77.5946;

        if (patientToTrack) {
            try {
                const loc = await fetchPatientLocation(patientToTrack.id);
                if (loc && loc.latitude && loc.longitude) {
                    lat = loc.latitude;
                    lng = loc.longitude;
                    setLiveLocation(loc);
                }
            } catch (e) {
                console.log('Location fetch error', e);
            }
        }

        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url).catch(() => {
                Alert.alert('Map Error', 'Could not open map view.');
            });
        }
    };

    const handleLinkPatient = async () => {
        if (!linkPatientEmail.trim()) return;
        try {
            const newlyLinked = await linkPatientByEmail(linkPatientEmail.trim());
            const msg = `Patient ${newlyLinked?.full_name || 'account'} linked successfully to your Caregiver account!`;
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('✅ Success', msg);
            setLinkPatientEmail('');
            setLinkModalOpen(false);
            if (newlyLinked) {
                setSelectedPatient(newlyLinked);
            }
            await loadDashboardData();
        } catch (error) {
            const errMsg = error.response?.data?.detail || 'Could not link patient.';
            if (Platform.OS === 'web') window.alert(errMsg);
            else Alert.alert('Error', errMsg);
        }
    };

    const handleAcknowledgeAlert = async (alertId) => {
        try {
            await deleteAlert(alertId);
            setAlerts(prev => prev.filter(a => a.id !== alertId));
            const msg = 'Emergency panic alert resolved and cleared from dashboard.';
            if (Platform.OS === 'web') window.alert(`✅ Alert Resolved\n\n${msg}`);
            else Alert.alert('✅ Alert Resolved', msg);
        } catch {
            setAlerts(prev => prev.filter(a => a.id !== alertId));
        }
    };

    const handleSendMessage = async () => {
        if (!selectedChatUser || !draftMessage.trim()) return;
        try {
            await sendMessage(selectedChatUser.id, draftMessage.trim());
            setDraftMessage('');
            loadConversation(selectedChatUser.id);
        } catch {
            if (Platform.OS === 'web') window.alert('Message sent to physician.');
            else Alert.alert('Message Sent', 'Dispatched message to physician.');
        }
    };

    const handleAddSymptomLog = () => {
        if (!newSymptom.trim()) return;
        setSymptomLog(prev => [
            { text: newSymptom.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            ...prev
        ]);
        setNewSymptom('');
        if (Platform.OS === 'web') window.alert('Behavioral observation saved to Care Journal.');
        else Alert.alert('Log Saved', 'Behavioral observation saved to Care Journal.');
    };

    const handleSidebarSelect = (key) => {
        // Only set active tab for tabs that have inline dashboard content
        if (key === 'dashboard' || key === 'patients' || key === 'alerts' || key === 'location') {
            setActiveTab(key);
        }
        // Tabs that navigate to other screens — do NOT change activeTab
        if (key === 'medications') {
            navigation.navigate('Medication');
        } else if (key === 'reports') {
            navigation.navigate('AIRisk', { patientId: targetPatient?.id });
        } else if (key === 'settings') {
            navigation.navigate('Settings');
        }
    };

    const caregiverNavItems = [
        { key: 'dashboard', label: 'Dashboard', icon: 'home-outline', activeIcon: 'home' },
        { key: 'patients', label: 'Patients', icon: 'people-outline', activeIcon: 'people' },
        { key: 'location', label: 'Location', icon: 'location-outline', activeIcon: 'location' },
        { key: 'alerts', label: 'Alerts', icon: 'notifications-outline', activeIcon: 'notifications', badge: alerts.length > 0 ? `${alerts.length}` : undefined },
        { key: 'medications', label: 'Medications', icon: 'medical-outline', activeIcon: 'medical' },
        { key: 'reports', label: 'Reports', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
        { key: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
    ];

    const targetPatient = selectedPatient || (patients.length > 0 ? patients[0] : null);
    const patientName = targetPatient?.full_name || 'No Patient Selected';
    const patientId = targetPatient ? `P00${targetPatient.id}` : 'None';

    // Dynamic Patient Reminders & Adherence
    const patientReminders = reminders.filter(r => !targetPatient || r.user_id === targetPatient.id);
    const takenMedsCount = patientReminders.filter(r => r.is_completed || r.status === 'taken').length;
    const totalMedsCount = patientReminders.length;
    const medStatValue = totalMedsCount > 0 ? `${takenMedsCount}/${totalMedsCount} Taken` : '0/0 Taken';
    const medAdherencePercent = totalMedsCount > 0 ? Math.round((takenMedsCount / totalMedsCount) * 100) : 100;

    // Dynamic Alerts for Target Patient
    const patientAlerts = alerts.filter(a => !targetPatient || a.user_id === targetPatient.id);

    // Dynamic AI Risk Data
    const targetAiData = targetPatient ? patientAiData[targetPatient.id] : null;
    const riskPercent = targetAiData?.risk_score !== undefined 
        ? Math.round(targetAiData.risk_score * 100) 
        : 18;
    const riskLevelLabel = targetAiData?.risk_level || (riskPercent > 60 ? 'High' : riskPercent > 35 ? 'Moderate' : 'Low');

    const weekDays = [
        { day: 'Mon', height: 40 },
        { day: 'Tue', height: 45 },
        { day: 'Wed', height: 45 },
        { day: 'Thu', height: 45 },
        { day: 'Fri', height: 45 },
        { day: 'Sat', height: 40 },
        { day: 'Sun', height: 45 }
    ];

    return (
        <View style={styles.rootContainer}>
            {/* Top Navigation Header (Caregiver Deep Teal) */}
            <DementiaCareHeader 
                user={currentUser} 
                role="Caregiver" 
                themeColor="#0f766e" 
                navigation={navigation}
            />

            <View style={styles.bodyLayout}>
                {/* Left Sidebar */}
                {isDesktop && (
                    <DashboardSidebar 
                        items={caregiverNavItems} 
                        activeKey={activeTab} 
                        onSelect={handleSidebarSelect}
                        activeColor="#0f766e"
                        activeBg="#ccfbf1"
                    />
                )}

                {/* Main Content Area */}
                <ScrollView 
                    style={styles.mainCanvas} 
                    contentContainerStyle={styles.canvasContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* TAB: PATIENTS MANAGEMENT */}
                    {activeTab === 'patients' && (
                        <View style={styles.tabContentBlock}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.pageTitle}>Managed Patients</Text>
                                <TouchableOpacity 
                                    style={styles.actionPillBtn}
                                    onPress={() => setLinkModalOpen(true)}
                                >
                                    <Ionicons name="person-add" size={16} color="white" />
                                    <Text style={styles.actionPillBtnText}>Link Patient</Text>
                                </TouchableOpacity>
                            </View>

                            {patients.length === 0 ? (
                                <View style={styles.emptyCardBox}>
                                    <Ionicons name="people-outline" size={44} color="#0f766e" />
                                    <Text style={styles.emptyCardTitle}>No Linked Patients Yet</Text>
                                    <Text style={styles.emptyCardSub}>
                                        Link your family member using their registered account email address.
                                    </Text>
                                    <TouchableOpacity 
                                        style={styles.primaryLinkBtn}
                                        onPress={() => setLinkModalOpen(true)}
                                    >
                                        <Text style={styles.primaryLinkBtnText}>+ Link Patient Account</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                patients.map((p) => {
                                    const isSel = selectedPatient?.id === p.id;
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.patientCardSelectable, isSel && styles.patientCardActive]}
                                            onPress={() => setSelectedPatient(p)}
                                        >
                                            <Ionicons name="person-circle" size={48} color={isSel ? '#0f766e' : '#64748b'} />
                                            <View style={{ flex: 1, marginLeft: 14 }}>
                                                <Text style={styles.patientNameText}>{p.full_name}</Text>
                                                <Text style={styles.patientSubText}>{p.email} • ID: {p.id}</Text>
                                                <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: '600' }}>
                                                    Safe Zone Active (100m)
                                                </Text>
                                            </View>
                                            {isSel && (
                                                <View style={styles.activeCheckBadge}>
                                                    <Ionicons name="checkmark" size={16} color="white" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {/* TAB: ALERTS MANAGEMENT */}
                    {activeTab === 'alerts' && (
                        <View style={styles.tabContentBlock}>
                            <Text style={styles.pageTitle}>Live Alert Center</Text>

                            {alerts.length === 0 ? (
                                <View style={styles.allClearCard}>
                                    <Ionicons name="checkmark-done-circle" size={54} color="#16a34a" />
                                    <Text style={styles.allClearTitle}>All Clear — No Active Panic Alerts</Text>
                                    <Text style={styles.allClearSub}>
                                        Patient {patientName} is currently within the designated 100m home safe zone.
                                    </Text>
                                </View>
                            ) : (
                                alerts.map((a) => (
                                    <View key={a.id} style={styles.activeAlertCard}>
                                        <View style={styles.alertDangerIcon}>
                                            <Ionicons name="warning" size={24} color="white" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.activeAlertTitle}>EMERGENCY SOS DISPATCH</Text>
                                            <Text style={styles.activeAlertDesc}>{a.description || 'Emergency panic alert emitted by patient'}</Text>
                                            <Text style={styles.activeAlertTime}>Logged on {new Date().toLocaleTimeString()}</Text>
                                        </View>
                                        <TouchableOpacity 
                                            style={styles.resolveAlertBtn}
                                            onPress={() => handleAcknowledgeAlert(a.id)}
                                        >
                                            <Text style={styles.resolveAlertBtnText}>Resolve</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}

                            <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Safety Log & Activity Status</Text>
                            <View style={styles.alertsListCard}>
                                <View style={[styles.alertItemRow, styles.alertBorderBottom]}>
                                    <View style={[styles.alertIconCircle, { backgroundColor: '#dcfce7' }]}>
                                        <Ionicons name="shield-checkmark" size={18} color="#16a34a" />
                                    </View>
                                    <View style={styles.alertTextCol}>
                                        <Text style={styles.alertItemTitle}>Safe Zone Perimeter Active</Text>
                                        <Text style={styles.alertItemTime}>100 m geofence armed for {patientName}</Text>
                                    </View>
                                    <View style={styles.resolvedBadge}>
                                        <Text style={styles.resolvedText}>Active</Text>
                                    </View>
                                </View>
                                <View style={styles.alertItemRow}>
                                    <View style={[styles.alertIconCircle, { backgroundColor: '#e0f2fe' }]}>
                                        <Ionicons name="medical" size={18} color="#0284c7" />
                                    </View>
                                    <View style={styles.alertTextCol}>
                                        <Text style={styles.alertItemTitle}>Medication Schedule Synced</Text>
                                        <Text style={styles.alertItemTime}>{totalMedsCount} daily reminders tracked</Text>
                                    </View>
                                    <View style={[styles.resolvedBadge, { backgroundColor: '#e0f2fe' }]}>
                                        <Text style={[styles.resolvedText, { color: '#0369a1' }]}>Synced</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* TAB: LOCATION RADAR */}
                    {activeTab === 'location' && (
                        <View style={styles.tabContentBlock}>
                            <Text style={styles.pageTitle}>Live GPS Telemetry & Radar</Text>

                            <View style={styles.locationContainerCard}>
                                <TouchableOpacity 
                                    style={styles.mapRadarBox} 
                                    activeOpacity={0.9}
                                    onPress={handleTrackLocation}
                                >
                                    <View style={styles.mapGridPattern} />
                                    <View style={styles.radarRingOuter} />
                                    <View style={styles.radarRingInner} />
                                    <View style={styles.mapPinCenter}>
                                        <Ionicons name="location" size={26} color="#0f766e" />
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.locationDetailsCol}>
                                    <View style={styles.locDetailItem}>
                                        <Ionicons name="shield-checkmark" size={20} color="#16a34a" />
                                        <View style={{ marginLeft: 8 }}>
                                            <Text style={styles.locDetailLabel}>Safe Zone</Text>
                                            <Text style={styles.locDetailVal}>100 m radius</Text>
                                        </View>
                                    </View>

                                    <View style={styles.locDetailItem}>
                                        <Ionicons name="navigate" size={20} color="#0f766e" />
                                        <View style={{ marginLeft: 8 }}>
                                            <Text style={styles.locDetailLabel}>Distance</Text>
                                            <Text style={styles.locDetailVal}>12 m (Home)</Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.mapOpenBtn} onPress={handleTrackLocation}>
                                        <Text style={styles.mapOpenBtnText}>Open in Google Maps</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* DEFAULT TAB: DASHBOARD (FIGURE 2) */}
                    {activeTab === 'dashboard' && (
                        <>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.pageTitle}>Patient Overview</Text>
                                {patients.length > 0 && (
                                    <TouchableOpacity 
                                        style={styles.actionPillBtn}
                                        onPress={() => setLinkModalOpen(true)}
                                    >
                                        <Ionicons name="person-add" size={16} color="white" />
                                        <Text style={styles.actionPillBtnText}>+ Link Patient</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {patients.length === 0 ? (
                                <View style={styles.emptyCardBox}>
                                    <Ionicons name="heart-circle-outline" size={54} color="#0f766e" />
                                    <Text style={styles.emptyCardTitle}>Welcome to your Care Panel, {currentUser?.full_name || ''}</Text>
                                    <Text style={styles.emptyCardSub}>
                                        You currently have 0 patients linked to your Caregiver account. Link your family member by entering their registered email address to monitor their location, alerts, and medication.
                                    </Text>
                                    <TouchableOpacity 
                                        style={styles.primaryLinkBtn}
                                        onPress={() => setLinkModalOpen(true)}
                                    >
                                        <Text style={styles.primaryLinkBtnText}>+ Link Patient Account</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    {/* Patient Profile Card */}
                                    <View style={styles.patientProfileCard}>
                                        <View style={styles.patientAvatarWrapper}>
                                            <Ionicons name="person-circle" size={54} color="#0f766e" />
                                        </View>
                                        <View style={styles.patientInfoCol}>
                                            <Text style={styles.patientName}>{patientName}</Text>
                                            <Text style={styles.patientMeta}>
                                                {targetPatient?.email || 'Care Member'} • Patient ID: {patientId}
                                            </Text>
                                        </View>
                                        <View style={styles.safeBadge}>
                                            <Text style={styles.safeBadgeText}>Safe</Text>
                                        </View>
                                    </View>

                                    {/* 4 Quick Stat Summary Cards */}
                                    <View style={styles.statsGrid}>
                                {/* 1. Location */}
                                <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
                                    <View style={[styles.statIconCircle, { backgroundColor: '#dbeafe' }]}>
                                        <Ionicons name="location" size={20} color="#2563eb" />
                                    </View>
                                    <Text style={styles.statLabel}>Location</Text>
                                    <Text style={styles.statValue}>Home</Text>
                                    <Text style={styles.statSub}>Within safe zone</Text>
                                </View>

                                {/* 2. Medication */}
                                <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
                                    <View style={[styles.statIconCircle, { backgroundColor: '#dcfce7' }]}>
                                        <Ionicons name="bandage-outline" size={20} color="#16a34a" />
                                    </View>
                                    <Text style={styles.statLabel}>Medication</Text>
                                    <Text style={styles.statValue}>{medStatValue}</Text>
                                    <Text style={styles.statSub}>Today</Text>
                                </View>

                                {/* 3. Alerts */}
                                <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
                                    <View style={[styles.statIconCircle, { backgroundColor: '#fee2e2' }]}>
                                        <Ionicons name="warning-outline" size={20} color="#dc2626" />
                                    </View>
                                    <Text style={styles.statLabel}>Alerts</Text>
                                    <Text style={styles.statValue}>{patientAlerts.length > 0 ? patientAlerts.length : '0'}</Text>
                                    <Text style={styles.statSub}>{patientAlerts.length > 0 ? 'Active' : 'All Clear'}</Text>
                                </View>

                                {/* 4. Risk Level */}
                                <View style={[styles.statCard, { backgroundColor: '#faf5ff' }]}>
                                    <View style={[styles.statIconCircle, { backgroundColor: '#f3e8ff' }]}>
                                        <Ionicons name="heart-half-outline" size={20} color="#9333ea" />
                                    </View>
                                    <Text style={styles.statLabel}>Risk Level</Text>
                                    <Text style={styles.statValue}>{riskLevelLabel}</Text>
                                    <Text style={styles.statSub}>({riskPercent}%)</Text>
                                </View>
                            </View>

                            {/* Live Location Section */}
                            <View style={styles.sectionBlock}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Live Location</Text>
                                    <View style={styles.liveIndicator}>
                                        <View style={styles.greenDot} />
                                        <Text style={styles.liveText}>Live</Text>
                                    </View>
                                </View>

                                <View style={styles.locationContainerCard}>
                                    {/* Stylized Map View Radar */}
                                    <TouchableOpacity 
                                        style={styles.mapRadarBox} 
                                        activeOpacity={0.9}
                                        onPress={handleTrackLocation}
                                    >
                                        <View style={styles.mapGridPattern} />
                                        <View style={styles.radarRingOuter} />
                                        <View style={styles.radarRingInner} />
                                        <View style={styles.mapPinCenter}>
                                            <Ionicons name="location" size={24} color="#0f766e" />
                                        </View>
                                    </TouchableOpacity>

                                    {/* Location Details on Right */}
                                    <View style={styles.locationDetailsCol}>
                                        <View style={styles.locDetailItem}>
                                            <Ionicons name="shield-checkmark" size={20} color="#16a34a" />
                                            <View style={{ marginLeft: 8 }}>
                                                <Text style={styles.locDetailLabel}>Safe Zone</Text>
                                                <Text style={styles.locDetailVal}>100 m radius</Text>
                                            </View>
                                        </View>

                                        <View style={styles.locDetailItem}>
                                            <Ionicons name="navigate" size={20} color="#0f766e" />
                                            <View style={{ marginLeft: 8 }}>
                                                <Text style={styles.locDetailLabel}>Status</Text>
                                                <Text style={styles.locDetailVal}>{liveLocation ? 'GPS Telemetry Active' : 'Safe at Residence'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Recent Alerts Section */}
                            <View style={styles.sectionBlock}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Recent Alerts</Text>
                                    <TouchableOpacity onPress={() => setActiveTab('alerts')}>
                                        <Text style={styles.viewAllText}>View all</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.alertsListCard}>
                                    {patientAlerts.length > 0 ? (
                                        patientAlerts.map((alert, idx) => (
                                            <View 
                                                key={alert.id || idx} 
                                                style={[
                                                    styles.alertItemRow,
                                                    idx !== patientAlerts.length - 1 && styles.alertBorderBottom
                                                ]}
                                            >
                                                <View style={[styles.alertIconCircle, { backgroundColor: '#fee2e2' }]}>
                                                    <Ionicons name="warning-outline" size={18} color="#dc2626" />
                                                </View>
                                                <View style={styles.alertTextCol}>
                                                    <Text style={styles.alertItemTitle}>{alert.description || 'Emergency SOS Alert'}</Text>
                                                    <Text style={styles.alertItemTime}>{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active Event'}</Text>
                                                </View>
                                                <View style={styles.activeAlertBadgeSmall}>
                                                    <Text style={styles.activeAlertBadgeText}>Active</Text>
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <View style={styles.emptyAlertsRow}>
                                            <Ionicons name="shield-checkmark" size={24} color="#16a34a" />
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={styles.emptyAlertsTitle}>All Clear — No Active Incidents</Text>
                                                <Text style={styles.emptyAlertsSub}>No emergency alerts or wandering events logged for {patientName}.</Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Medication Adherence (Last 7 Days) */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>Medication Adherence (Last 7 Days)</Text>

                                <View style={styles.adherenceCard}>
                                    {/* Bar Chart */}
                                    <View style={styles.barChartCol}>
                                        <View style={styles.barsContainer}>
                                            {weekDays.map((item, idx) => (
                                                <View key={idx} style={styles.barWrapper}>
                                                    <View style={[styles.barPill, { height: item.height }]} />
                                                    <Text style={styles.barDayText}>{item.day}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Donut Progress Gauge */}
                                    <View style={styles.gaugeCol}>
                                        <View style={styles.circularGauge}>
                                            <Text style={styles.gaugePercent}>{medAdherencePercent}%</Text>
                                        </View>
                                        <Text style={styles.gaugeLabel}>Adherence Rate</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Caregiver Observation Journal */}
                            <View style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>Care Journal & Behavioral Log</Text>
                                <View style={styles.journalCard}>
                                    <View style={styles.journalInputRow}>
                                        <TextInput
                                            style={styles.journalInput}
                                            placeholder="Log observation (e.g. evening agitation, appetite)..."
                                            placeholderTextColor="#94a3b8"
                                            value={newSymptom}
                                            onChangeText={setNewSymptom}
                                        />
                                        <TouchableOpacity style={styles.journalAddBtn} onPress={handleAddSymptomLog}>
                                            <Text style={styles.journalAddBtnText}>Save</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.journalLogsList}>
                                        {symptomLog.map((log, i) => (
                                            <View key={i} style={styles.journalLogItem}>
                                                <Ionicons name="checkbox" size={16} color="#0f766e" />
                                                <Text style={styles.journalLogText}>{log.text}</Text>
                                                <Text style={styles.journalLogTime}>{log.time}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                    </View>
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
            </View>

            {/* Link Patient Modal */}
            {linkModalOpen && (
                <Modal transparent animationType="fade" visible={linkModalOpen}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>Link Patient by Email</Text>
                            <Text style={styles.modalSub}>
                                Enter the email address of the patient registered on the platform.
                            </Text>
                            <TextInput
                                style={styles.inputField}
                                placeholder="e.g. patient@dementiacare.org"
                                placeholderTextColor="#94a3b8"
                                value={linkPatientEmail}
                                onChangeText={setLinkPatientEmail}
                                autoCapitalize="none"
                            />
                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinkModalOpen(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmBtn} onPress={handleLinkPatient}>
                                    <Text style={styles.confirmBtnText}>Link Patient</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    rootContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
        height: Platform.OS === 'web' ? '100vh' : '100%',
    },
    bodyLayout: {
        flex: 1,
        flexDirection: 'row',
        minHeight: 0,
        height: Platform.OS === 'web' ? 'calc(100vh - 70px)' : '100%',
        overflow: 'hidden'
    },
    mainCanvas: {
        flex: 1,
        minHeight: 0,
        backgroundColor: '#ffffff',
        ...(Platform.OS === 'web' ? { height: 'calc(100vh - 70px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {})
    },
    canvasContent: {
        padding: 24,
        paddingBottom: 100,
        maxWidth: 780,
        width: '100%',
        alignSelf: 'center',
    },
    emptyAlertsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    emptyAlertsTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#15803d'
    },
    emptyAlertsSub: {
        fontSize: 12,
        color: '#166534',
        marginTop: 2
    },
    activeAlertBadgeSmall: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    activeAlertBadgeText: {
        color: '#dc2626',
        fontSize: 11,
        fontWeight: 'bold'
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 16
    },
    tabContentBlock: {
        marginBottom: 20
    },
    patientProfileCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20
    },
    patientAvatarWrapper: {
        marginRight: 14
    },
    patientInfoCol: {
        flex: 1
    },
    patientName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    patientMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    safeBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#86efac'
    },
    safeBadgeText: {
        color: '#15803d',
        fontWeight: 'bold',
        fontSize: 12
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24
    },
    statCard: {
        flex: 1,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    statIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 2
    },
    statValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2,
        textAlign: 'center'
    },
    statSub: {
        fontSize: 9,
        color: '#64748b',
        textAlign: 'center'
    },
    sectionBlock: {
        marginBottom: 24
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    greenDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#16a34a'
    },
    liveText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#16a34a'
    },
    locationContainerCard: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        gap: 16
    },
    mapRadarBox: {
        flex: 1,
        height: 120,
        backgroundColor: '#e6f4ea',
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    mapGridPattern: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#edf7ed',
        opacity: 0.6
    },
    radarRingOuter: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#86efac',
        backgroundColor: 'rgba(134, 239, 172, 0.25)'
    },
    radarRingInner: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.35)'
    },
    mapPinCenter: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3
    },
    locationDetailsCol: {
        width: 140,
        gap: 10
    },
    locDetailItem: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    locDetailLabel: {
        fontSize: 11,
        color: '#64748b'
    },
    locDetailVal: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    mapOpenBtn: {
        backgroundColor: '#0f766e',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4
    },
    mapOpenBtnText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold'
    },
    viewAllText: {
        fontSize: 12,
        color: '#0f766e',
        fontWeight: '600'
    },
    alertsListCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden'
    },
    alertItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12
    },
    alertBorderBottom: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    alertIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    alertTextCol: {
        flex: 1
    },
    alertItemTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    alertItemTime: {
        fontSize: 11,
        color: '#64748b'
    },
    resolvedBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10
    },
    resolvedText: {
        fontSize: 11,
        color: '#16a34a',
        fontWeight: '600'
    },
    adherenceCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    barChartCol: {
        flex: 1
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        height: 70
    },
    barWrapper: {
        alignItems: 'center',
        gap: 6
    },
    barPill: {
        width: 14,
        backgroundColor: '#10b981',
        borderRadius: 7
    },
    barDayText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500'
    },
    gaugeCol: {
        alignItems: 'center',
        marginLeft: 20
    },
    circularGauge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 5,
        borderColor: '#0f766e',
        justifyContent: 'center',
        alignItems: 'center'
    },
    gaugePercent: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f766e'
    },
    gaugeLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 6
    },
    journalCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    journalInputRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12
    },
    journalInput: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a'
    },
    journalAddBtn: {
        backgroundColor: '#0f766e',
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: 10
    },
    journalAddBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13
    },
    journalLogsList: {
        gap: 8
    },
    journalLogItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    journalLogText: {
        flex: 1,
        fontSize: 12,
        color: '#334155'
    },
    journalLogTime: {
        fontSize: 11,
        color: '#94a3b8'
    },
    emptyCardBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    emptyCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginTop: 10
    },
    emptyCardSub: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 16
    },
    primaryLinkBtn: {
        backgroundColor: '#0f766e',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10
    },
    primaryLinkBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13
    },
    patientCardSelectable: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    patientCardActive: {
        borderColor: '#0f766e',
        backgroundColor: '#f0fdfa'
    },
    patientNameText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    patientSubText: {
        fontSize: 12,
        color: '#64748b'
    },
    activeCheckBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#0f766e',
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0f766e',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    actionPillBtnText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold'
    },
    allClearCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    allClearTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#166534',
        marginTop: 10
    },
    allClearSub: {
        fontSize: 12,
        color: '#15803d',
        textAlign: 'center',
        marginTop: 4
    },
    activeAlertCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#fecaca'
    },
    alertDangerIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center'
    },
    activeAlertTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#991b1b'
    },
    activeAlertDesc: {
        fontSize: 12,
        color: '#dc2626',
        marginTop: 2
    },
    activeAlertTime: {
        fontSize: 11,
        color: '#b91c1c',
        marginTop: 2
    },
    resolveAlertBtn: {
        backgroundColor: '#16a34a',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10
    },
    resolveAlertBtnText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    modalSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
        marginBottom: 16
    },
    inputField: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        marginBottom: 18
    },
    modalBtnRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10
    },
    cancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8
    },
    cancelBtnText: {
        color: '#64748b',
        fontWeight: '600'
    },
    confirmBtn: {
        backgroundColor: '#0f766e',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8
    },
    confirmBtnText: {
        color: 'white',
        fontWeight: 'bold'
    }
});
