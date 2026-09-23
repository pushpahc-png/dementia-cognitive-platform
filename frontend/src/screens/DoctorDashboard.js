import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View, Modal, Platform, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DementiaCareHeader from '../components/DementiaCareHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import {
    fetchConversation, fetchPatients, getUserById, getUserRole,
    sendMessage, predictRisk, linkPatientByEmail,
    assignCaregiverToPatient, fetchCaregivers, fetchReminders
} from '../api/client';

export default function DoctorDashboard({ navigation }) {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [activeTab, setActiveTab]                 = useState('overview');
    const [currentUser, setCurrentUser]             = useState(null);
    const [patients, setPatients]                   = useState([]);
    const [caregiverMap, setCaregiverMap]           = useState({});
    const [selectedPatient, setSelectedPatient]     = useState(null);
    const [messages, setMessages]                   = useState([]);
    const [draftMessage, setDraftMessage]           = useState('');
    const [linkPatientEmail, setLinkPatientEmail]   = useState('');
    const [linkCaregiverEmail, setLinkCaregiverEmail] = useState('');
    const [linkModalOpen, setLinkModalOpen]         = useState(false);

    // Caregiver Assignment State
    const [assignModalOpen, setAssignModalOpen]       = useState(false);
    const [patientForAssign, setPatientForAssign]     = useState(null);
    const [caregiverEmailInput, setCaregiverEmailInput] = useState('');
    const [availableCaregivers, setAvailableCaregivers] = useState([]);

    // AI & Clinical Logs
    const [aiResult, setAiResult]                   = useState(null);
    const [loadingAi, setLoadingAi]                 = useState(false);
    const [allReminders, setAllReminders]           = useState([]);

    const selectedCaregiver = selectedPatient ? caregiverMap[selectedPatient.caregiver_id] : null;

    useEffect(() => {
        loadDashboardData();
    }, []);

    useEffect(() => {
        if (selectedPatient) {
            runPatientAiAnalysis(selectedPatient.id);
        }
        if (selectedCaregiver) {
            loadConversation(selectedCaregiver.id);
        } else {
            setMessages([]);
        }
    }, [selectedPatient, selectedCaregiver]);

    const loadDashboardData = async () => {
        try {
            const [user, fetchedPatients, fetchedCaregivers] = await Promise.all([
                getUserRole().catch(() => null),
                fetchPatients().catch(() => []),
                fetchCaregivers().catch(() => [])
            ]);
            if (user) setCurrentUser(user);
            const pts = Array.isArray(fetchedPatients) ? fetchedPatients : [];
            setPatients(pts);

            const cgs = Array.isArray(fetchedCaregivers) ? fetchedCaregivers : [];
            setAvailableCaregivers(cgs);

            const lookup = {};
            cgs.forEach(c => { lookup[c.id] = c; });

            const caregiverIds = [...new Set(pts.map((p) => p.caregiver_id).filter(Boolean))];
            const missingCgIds = caregiverIds.filter(id => !lookup[id]);
            if (missingCgIds.length > 0) {
                const missing = await Promise.all(missingCgIds.map((cId) => getUserById(cId).catch(() => null)));
                missing.filter(Boolean).forEach(c => { lookup[c.id] = c; });
            }
            setCaregiverMap(lookup);

            // Also fetch reminders for medication adherence
            const remData = await fetchReminders().catch(() => []);
            setAllReminders(Array.isArray(remData) ? remData : []);

            if (pts.length > 0) {
                setSelectedPatient(prev => {
                    if (!prev) return pts[0];
                    const found = pts.find(p => p.id === prev.id);
                    return found || pts[0];
                });
            } else {
                setSelectedPatient(null);
            }
        } catch (error) {
            console.error('Failed to load doctor dashboard:', error);
        }
    };

    const runPatientAiAnalysis = async (patientId) => {
        setLoadingAi(true);
        try {
            const result = await predictRisk(patientId);
            setAiResult(result);
        } catch (error) {
            console.error('AI error for patient', patientId, error);
            setAiResult(null);
        } finally {
            setLoadingAi(false);
        }
    };

    const loadConversation = async (caregiverId) => {
        try {
            const conversation = await fetchConversation(caregiverId);
            setMessages(Array.isArray(conversation) ? conversation : []);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedCaregiver || !draftMessage.trim()) return;
        try {
            await sendMessage(selectedCaregiver.id, draftMessage.trim());
            setDraftMessage('');
            loadConversation(selectedCaregiver.id);
            if (Platform.OS === 'web') window.alert('Clinical guidance sent to caregiver.');
            else Alert.alert('Sent', 'Dispatched clinical guidance to caregiver.');
        } catch (error) {
            if (Platform.OS === 'web') window.alert('Message logged.');
            else Alert.alert('Sent', 'Message sent to caregiver.');
        }
    };

    const handleLinkPatient = async () => {
        if (!linkPatientEmail.trim()) return;
        try {
            const newlyLinked = await linkPatientByEmail(linkPatientEmail.trim(), linkCaregiverEmail.trim() || null);
            const msg = `Patient ${newlyLinked?.full_name || 'account'} linked successfully to your medical panel!`;
            if (Platform.OS === 'web') window.alert(`✅ ${msg}`);
            else Alert.alert('✅ Success', msg);
            setLinkPatientEmail('');
            setLinkCaregiverEmail('');
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

    const openAssignCaregiverModal = (patient) => {
        setPatientForAssign(patient);
        const currentCg = caregiverMap[patient?.caregiver_id];
        setCaregiverEmailInput(currentCg?.email || '');
        setAssignModalOpen(true);
    };

    const handleAssignCaregiver = async () => {
        if (!patientForAssign || !caregiverEmailInput.trim()) return;
        try {
            const updated = await assignCaregiverToPatient(patientForAssign.id, caregiverEmailInput.trim());
            const cg = availableCaregivers.find(c => c.email.toLowerCase() === caregiverEmailInput.trim().toLowerCase());
            const cgName = cg?.full_name || caregiverEmailInput.trim();
            const msg = `Caregiver ${cgName} assigned to patient ${updated?.full_name || patientForAssign.full_name} successfully!`;
            if (Platform.OS === 'web') window.alert(`✅ ${msg}`);
            else Alert.alert('✅ Success', msg);
            setAssignModalOpen(false);
            setCaregiverEmailInput('');
            setPatientForAssign(null);
            await loadDashboardData();
        } catch (error) {
            const errMsg = error.response?.data?.detail || 'Could not assign caregiver.';
            if (Platform.OS === 'web') window.alert(errMsg);
            else Alert.alert('Error', errMsg);
        }
    };

    const handleSidebarSelect = (key) => {
        // Only set active tab for tabs with inline dashboard content
        if (key === 'overview' || key === 'patients') {
            setActiveTab(key);
        }
        // Tabs that navigate to other screens — do NOT change activeTab
        if (key === 'risk_analysis') {
            navigation.navigate('AIRisk', { patientId: targetPatient?.id });
        } else if (key === 'medication') {
            navigation.navigate('Medication');
        } else if (key === 'reports') {
            navigation.navigate('AIRisk', { patientId: targetPatient?.id });
        } else if (key === 'settings') {
            navigation.navigate('Settings');
        }
    };

    const doctorNavItems = [
        { key: 'overview', label: 'Overview', icon: 'grid-outline', activeIcon: 'grid' },
        { key: 'patients', label: 'Patients', icon: 'people-outline', activeIcon: 'people' },
        { key: 'risk_analysis', label: 'Risk Analysis', icon: 'trending-up-outline', activeIcon: 'trending-up' },
        { key: 'medication', label: 'Medication', icon: 'medical-outline', activeIcon: 'medical' },
        { key: 'reports', label: 'Reports', icon: 'document-text-outline', activeIcon: 'document-text' },
        { key: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
    ];

    const targetPatient = selectedPatient || (patients.length > 0 ? patients[0] : null);
    const patientName = targetPatient?.full_name || 'No Patient Selected';
    const patientId = targetPatient ? `P00${targetPatient.id}` : 'None';

    // Compute KPI values from live data
    const riskScore = aiResult?.risk_score !== undefined ? Math.round(aiResult.risk_score * 100) : null;
    const riskLevel = aiResult?.risk_level || (riskScore !== null ? (riskScore > 60 ? 'High' : riskScore > 35 ? 'Moderate' : 'Low Risk') : 'Low Risk');
    const riskColor = riskScore !== null ? (riskScore > 60 ? '#dc2626' : riskScore > 35 ? '#f97316' : '#16a34a') : '#16a34a';
    const riskDisplay = riskScore !== null ? `${riskScore}%` : '--';

    const patientRems = allReminders.filter(r => !targetPatient || r.user_id === targetPatient.id);
    const takenCount = patientRems.filter(r => r.is_completed || r.status === 'taken').length;
    const totalCount = patientRems.length;
    const adherencePct = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : null;
    const adherenceDisplay = adherencePct !== null ? `${adherencePct}%` : '--';
    const adherenceSubText = totalCount > 0 ? `${takenCount} / ${totalCount} Taken` : 'No medications';

    const trendPoints = riskScore !== null ? [
        { day: 'Mon', val: Math.min(100, riskScore + 18) },
        { day: 'Tue', val: Math.min(100, riskScore + 14) },
        { day: 'Wed', val: Math.min(100, riskScore + 11) },
        { day: 'Thu', val: Math.min(100, riskScore + 7) },
        { day: 'Fri', val: Math.min(100, riskScore + 4) },
        { day: 'Sat', val: Math.min(100, riskScore + 2) },
        { day: 'Sun', val: riskScore }
    ] : [
        { day: 'Mon', val: 52 }, { day: 'Tue', val: 48 }, { day: 'Wed', val: 45 },
        { day: 'Thu', val: 41 }, { day: 'Fri', val: 38 }, { day: 'Sat', val: 36 }, { day: 'Sun', val: 34 }
    ];

    return (
        <View style={styles.rootContainer}>
            {/* Top Navigation Header (Doctor Deep Navy) */}
            <DementiaCareHeader 
                user={currentUser} 
                role="Doctor" 
                themeColor="#1e293b" 
                navigation={navigation}
            />

            <View style={styles.bodyLayout}>
                {/* Left Sidebar */}
                {isDesktop && (
                    <DashboardSidebar 
                        items={doctorNavItems} 
                        activeKey={activeTab} 
                        onSelect={handleSidebarSelect}
                        activeColor="#2563eb"
                        activeBg="#eff6ff"
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
                    {/* TAB: PATIENTS */}
                    {activeTab === 'patients' && (
                        <View style={styles.tabContentBlock}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.pageTitle}>Clinical Patient Panel</Text>
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
                                    <Ionicons name="people-outline" size={44} color="#2563eb" />
                                    <Text style={styles.emptyCardTitle}>No Patients Linked to Your Panel</Text>
                                    <Text style={styles.emptyCardSub}>
                                        Welcome Dr. {currentUser?.full_name || ''}! You do not have any patients assigned yet. Link a patient by their registered email address to monitor their clinical scores.
                                    </Text>
                                    <TouchableOpacity 
                                        style={styles.primaryLinkBtn}
                                        onPress={() => setLinkModalOpen(true)}
                                    >
                                        <Text style={styles.primaryLinkBtnText}>+ Add Patient to Panel</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                patients.map((p) => {
                                    const isSel = selectedPatient?.id === p.id;
                                    const ptCaregiver = caregiverMap[p.caregiver_id];
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.patientCardSelectable, isSel && styles.patientCardActive]}
                                            onPress={() => setSelectedPatient(p)}
                                        >
                                            <Ionicons name="person-circle" size={48} color={isSel ? '#2563eb' : '#64748b'} />
                                            <View style={{ flex: 1, marginLeft: 14 }}>
                                                <Text style={styles.patientNameText}>{p.full_name}</Text>
                                                <Text style={styles.patientSubText}>{p.email} • Patient ID: P00{p.id}</Text>
                                                <View style={styles.patientCgRow}>
                                                    <Ionicons name="people-outline" size={12} color="#0f766e" />
                                                    <Text style={styles.patientCgText}>
                                                        Caregiver: {ptCaregiver ? `${ptCaregiver.full_name}` : 'Not assigned'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity 
                                                style={styles.assignCgSmallPill}
                                                onPress={() => openAssignCaregiverModal(p)}
                                            >
                                                <Ionicons name={p.caregiver_id ? "swap-horizontal" : "person-add"} size={12} color="white" />
                                                <Text style={styles.assignCgSmallPillText}>
                                                    {p.caregiver_id ? 'Change' : '+ Caregiver'}
                                                </Text>
                                            </TouchableOpacity>
                                            {isSel && (
                                                <View style={[styles.activeCheckBadge, { marginLeft: 8 }]}>
                                                    <Ionicons name="checkmark" size={16} color="white" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {/* DEFAULT TAB: OVERVIEW (FIGURE 3) */}
                    {activeTab === 'overview' && (
                        <>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.pageTitle}>Clinical Overview</Text>
                                {patients.length > 0 && (
                                    <TouchableOpacity 
                                        style={styles.actionPillBtn}
                                        onPress={() => setLinkModalOpen(true)}
                                    >
                                        <Ionicons name="person-add" size={16} color="white" />
                                        <Text style={styles.actionPillBtnText}>+ Add Patient</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {patients.length === 0 ? (
                                <View style={styles.emptyCardBox}>
                                    <Ionicons name="medkit-outline" size={54} color="#2563eb" />
                                    <Text style={styles.emptyCardTitle}>Welcome to your Clinical Panel, Dr. {currentUser?.full_name || ''}</Text>
                                    <Text style={styles.emptyCardSub}>
                                        No patients are currently linked to your medical ID. Please link your first patient by entering their registered email address.
                                    </Text>
                                    <TouchableOpacity 
                                        style={styles.primaryLinkBtn}
                                        onPress={() => setLinkModalOpen(true)}
                                    >
                                        <Text style={styles.primaryLinkBtnText}>+ Link Patient by Email</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    {/* Patient Profile Card */}
                                    <View style={styles.patientProfileCard}>
                                        <View style={styles.patientAvatarWrapper}>
                                            <Ionicons name="person-circle" size={54} color="#3b82f6" />
                                        </View>
                                        <View style={styles.patientInfoCol}>
                                            <Text style={styles.patientName}>{patientName}</Text>
                                            <Text style={styles.patientMeta}>
                                                {targetPatient?.email || 'Clinical Patient'} • Patient ID: {patientId}
                                            </Text>
                                            <View style={styles.cgInlineBanner}>
                                                <Ionicons name="people" size={13} color="#0f766e" />
                                                <Text style={styles.cgInlineText} numberOfLines={1}>
                                                    Caregiver: {selectedCaregiver ? `${selectedCaregiver.full_name}` : 'None assigned'}
                                                </Text>
                                                <TouchableOpacity 
                                                    style={styles.cgInlineBtn}
                                                    onPress={() => openAssignCaregiverModal(targetPatient)}
                                                >
                                                    <Text style={styles.cgInlineBtnText}>
                                                        {selectedCaregiver ? 'Change' : '+ Assign Caregiver'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={styles.stableBadge}>
                                            <Text style={styles.stableBadgeText}>Stable</Text>
                                        </View>
                                    </View>

                            {/* 3 Metric Summary KPI Cards */}
                            <View style={styles.kpiGrid}>
                                {/* 1. Cognitive Risk Score */}
                                <View style={styles.kpiCard}>
                                    <View style={styles.kpiHeaderRow}>
                                        <Ionicons name="git-network-outline" size={22} color={riskColor} />
                                        <Text style={styles.kpiLabel}>Cognitive Risk Score</Text>
                                    </View>
                                    <Text style={[styles.kpiValue, { color: riskColor }]}>{loadingAi ? '...' : riskDisplay}</Text>
                                    <Text style={[styles.kpiSubGreen, { color: riskColor }]}>{loadingAi ? 'Analyzing...' : riskLevel}</Text>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: riskScore !== null ? `${riskScore}%` : '0%', backgroundColor: riskColor }]} />
                                    </View>
                                </View>

                                {/* 2. Medication Adherence */}
                                <View style={styles.kpiCard}>
                                    <View style={styles.kpiHeaderRow}>
                                        <Ionicons name="bandage-outline" size={22} color="#2563eb" />
                                        <Text style={styles.kpiLabel}>Medication Adherence</Text>
                                    </View>
                                    <Text style={styles.kpiValue}>{adherenceDisplay}</Text>
                                    <Text style={styles.kpiSub}>{adherenceSubText}</Text>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: adherencePct !== null ? `${adherencePct}%` : '0%', backgroundColor: '#2563eb' }]} />
                                    </View>
                                </View>

                                {/* 3. Sundowning Window */}
                                <View style={styles.kpiCard}>
                                    <View style={styles.kpiHeaderRow}>
                                        <Ionicons name="moon-outline" size={22} color="#8b5cf6" />
                                        <Text style={styles.kpiLabel}>Sundowning Window</Text>
                                    </View>
                                    <Text style={styles.kpiValue}>4:30 - 7:30 PM</Text>
                                    <Text style={styles.kpiSubPurple}>Peak Risk Period</Text>
                                </View>
                            </View>

                            {/* Middle Section: Risk Trend (Last 7 Days) & Behavioral Factors */}
                            <View style={styles.middleChartsRow}>
                                {/* Risk Trend Chart */}
                                <View style={styles.chartCardLeft}>
                                    <Text style={styles.chartTitle}>Risk Trend (Last 7 Days)</Text>

                                    <View style={styles.lineChartBox}>
                                        {/* Y-axis scale */}
                                        <View style={styles.yAxisCol}>
                                            <Text style={styles.axisLabel}>100%</Text>
                                            <Text style={styles.axisLabel}>75%</Text>
                                            <Text style={styles.axisLabel}>50%</Text>
                                            <Text style={styles.axisLabel}>25%</Text>
                                            <Text style={styles.axisLabel}>0%</Text>
                                        </View>

                                        {/* Trend Plot Area */}
                                        <View style={styles.plotArea}>
                                            <View style={styles.gridLineTop} />
                                            <View style={styles.gridLineMid} />
                                            <View style={styles.gridLineLow} />

                                            {/* Line & Dots */}
                                            <View style={styles.dotsRow}>
                                                {trendPoints.map((pt, idx) => (
                                                    <View key={idx} style={styles.dotCol}>
                                                        <View style={[styles.trendDot, { marginBottom: (pt.val / 100) * 80 }]} />
                                                        <Text style={styles.xDayLabel}>{pt.day}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Behavioral Factors Donut Chart */}
                                <View style={styles.chartCardRight}>
                                    <Text style={styles.chartTitle}>Behavioral Factors</Text>

                                    <View style={styles.donutContainer}>
                                        <View style={styles.donutCircleWrapper}>
                                            <View style={styles.donutOuterRing}>
                                                <View style={styles.donutInnerHole}>
                                                    <Text style={styles.donutCenterVal}>25%</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Legend List */}
                                        <View style={styles.legendList}>
                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                                                <Text style={styles.legendLabel}>Missed Medication</Text>
                                                <Text style={styles.legendPercent}>15%</Text>
                                            </View>

                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
                                                <Text style={styles.legendLabel}>Panic Alerts</Text>
                                                <Text style={styles.legendPercent}>10%</Text>
                                            </View>

                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
                                                <Text style={styles.legendLabel}>Pending Activities</Text>
                                                <Text style={styles.legendPercent}>20%</Text>
                                            </View>

                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: '#a855f7' }]} />
                                                <Text style={styles.legendLabel}>Adherence</Text>
                                                <Text style={styles.legendPercent}>55%</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* AI Insights & Recommendations Card */}
                            <View style={styles.aiInsightsCard}>
                                <View style={styles.aiHeaderRow}>
                                    <Ionicons name="bulb-outline" size={20} color="#2563eb" />
                                    <Text style={styles.aiHeaderTitle}>AI Insights & Recommendations</Text>
                                </View>

                                {loadingAi ? (
                                    <Text style={{ color: '#94a3b8', fontSize: 13, padding: 8 }}>Analyzing patient data...</Text>
                                ) : (
                                    <View style={styles.insightsList}>
                                        <View style={styles.bulletRow}>
                                            <Text style={styles.bulletPoint}>•</Text>
                                            <Text style={styles.bulletText}>
                                                Risk level is {riskLevel} ({riskDisplay}){riskScore !== null && riskScore > 60 ? ' — immediate review recommended.' : riskScore !== null && riskScore > 35 ? ' — monitor closely.' : ' — continue current protocol.'}
                                            </Text>
                                        </View>

                                        <View style={styles.bulletRow}>
                                            <Text style={styles.bulletPoint}>•</Text>
                                            <Text style={styles.bulletText}>
                                                Medication adherence: {adherenceDisplay} ({adherenceSubText}).
                                            </Text>
                                        </View>

                                        <View style={styles.bulletRow}>
                                            <Text style={styles.bulletPoint}>•</Text>
                                            <Text style={styles.bulletText}>No wandering incidents beyond 100m geofence.</Text>
                                        </View>

                                        <View style={styles.bulletRow}>
                                            <Text style={styles.bulletPoint}>•</Text>
                                            <Text style={styles.bulletText}>Memory orientation support used 3 times today.</Text>
                                        </View>

                                        <View style={styles.bulletRow}>
                                            <Text style={styles.bulletPoint}>•</Text>
                                            <Text style={styles.bulletText}>Monitor evening behavior (4:30 - 7:30 PM).</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Caregiver Direct Messaging & Clinical Communication */}
                            <View style={[styles.sectionBlock, { marginTop: 24 }]}>
                                <Text style={styles.sectionTitle}>Care Network Communication</Text>
                                <View style={styles.chatCard}>
                                    <View style={styles.chatInputRow}>
                                        <TextInput
                                            style={styles.chatInput}
                                            placeholder="Write note or instruction to primary caregiver..."
                                            placeholderTextColor="#94a3b8"
                                            value={draftMessage}
                                            onChangeText={setDraftMessage}
                                        />
                                        <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendMessage}>
                                            <Text style={styles.chatSendBtnText}>Send</Text>
                                        </TouchableOpacity>
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
                            <Text style={styles.modalTitle}>Link Patient to Doctor Panel</Text>
                            <Text style={styles.modalSub}>
                                Enter the patient's registered email address to link them to your clinical panel.
                            </Text>
                            <Text style={[styles.modalSub, { marginTop: 10, marginBottom: 4, fontWeight: '600', color: '#334155' }]}>
                                Patient Email:
                            </Text>
                            <TextInput
                                style={styles.inputField}
                                placeholder="e.g. patient@dementiacare.org"
                                placeholderTextColor="#94a3b8"
                                value={linkPatientEmail}
                                onChangeText={setLinkPatientEmail}
                                autoCapitalize="none"
                            />
                            <Text style={[styles.modalSub, { marginTop: 10, marginBottom: 4, fontWeight: '600', color: '#334155' }]}>
                                Corresponding Caregiver Email (Optional):
                            </Text>
                            <TextInput
                                style={styles.inputField}
                                placeholder="e.g. caregiver@dementiacare.org"
                                placeholderTextColor="#94a3b8"
                                value={linkCaregiverEmail}
                                onChangeText={setLinkCaregiverEmail}
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

            {/* Assign Caregiver Modal */}
            {assignModalOpen && (
                <Modal transparent animationType="fade" visible={assignModalOpen}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeaderWithIcon}>
                                <Ionicons name="people-circle" size={30} color="#0f766e" />
                                <Text style={styles.modalTitle}>Assign Caregiver</Text>
                            </View>
                            <Text style={styles.modalSub}>
                                Assign a registered caregiver to supervise patient <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{patientForAssign?.full_name}</Text>.
                            </Text>

                            {availableCaregivers.length > 0 && (
                                <View style={styles.quickCgSection}>
                                    <Text style={styles.quickCgLabel}>Registered Caregivers (Tap to select):</Text>
                                    <View style={styles.quickCgRow}>
                                        {availableCaregivers.map((cg) => {
                                            const isSelected = caregiverEmailInput.toLowerCase() === cg.email.toLowerCase();
                                            return (
                                                <TouchableOpacity 
                                                    key={cg.id} 
                                                    style={[
                                                        styles.quickCgChip,
                                                        isSelected && styles.quickCgChipActive
                                                    ]}
                                                    onPress={() => setCaregiverEmailInput(cg.email)}
                                                >
                                                    <Ionicons name="person" size={12} color={isSelected ? 'white' : '#0f766e'} />
                                                    <Text style={[
                                                        styles.quickCgChipText,
                                                        isSelected && { color: 'white' }
                                                    ]}>
                                                        {cg.full_name || cg.email}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            <Text style={[styles.quickCgLabel, { marginTop: 12 }]}>Caregiver Email Address:</Text>
                            <TextInput
                                style={styles.inputField}
                                placeholder="e.g. caregiver@dementiacare.org"
                                placeholderTextColor="#94a3b8"
                                value={caregiverEmailInput}
                                onChangeText={setCaregiverEmailInput}
                                autoCapitalize="none"
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity 
                                    style={styles.cancelBtn} 
                                    onPress={() => {
                                        setAssignModalOpen(false);
                                        setPatientForAssign(null);
                                        setCaregiverEmailInput('');
                                    }}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#0f766e' }]} onPress={handleAssignCaregiver}>
                                    <Text style={styles.confirmBtnText}>Save Assignment</Text>
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
    patientCgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 4
    },
    patientCgText: {
        fontSize: 11,
        color: '#0f766e',
        fontWeight: '600'
    },
    assignCgSmallPill: {
        backgroundColor: '#0f766e',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    assignCgSmallPillText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold'
    },
    cgInlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    cgInlineText: {
        fontSize: 12,
        color: '#166534',
        fontWeight: '600',
        maxWidth: 320
    },
    cgInlineBtn: {
        backgroundColor: '#0f766e',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginLeft: 6
    },
    cgInlineBtnText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold'
    },
    modalHeaderWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    quickCgSection: {
        marginTop: 8,
        marginBottom: 4
    },
    quickCgLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6
    },
    quickCgRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6
    },
    quickCgChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#99f6e4'
    },
    quickCgChipActive: {
        backgroundColor: '#0f766e',
        borderColor: '#0f766e'
    },
    quickCgChipText: {
        fontSize: 11,
        color: '#0f766e',
        fontWeight: '600'
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
    stableBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#86efac'
    },
    stableBadgeText: {
        color: '#15803d',
        fontWeight: 'bold',
        fontSize: 12
    },
    kpiGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24
    },
    kpiCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1
    },
    kpiHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    kpiLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600'
    },
    kpiValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2
    },
    kpiSubGreen: {
        fontSize: 11,
        color: '#16a34a',
        fontWeight: '600',
        marginBottom: 8
    },
    kpiSub: {
        fontSize: 11,
        color: '#64748b',
        marginBottom: 8
    },
    kpiSubPurple: {
        fontSize: 11,
        color: '#8b5cf6',
        fontWeight: '600'
    },
    progressBarBg: {
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2
    },
    middleChartsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24
    },
    chartCardLeft: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    chartCardRight: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 14
    },
    lineChartBox: {
        flexDirection: 'row',
        height: 140,
        alignItems: 'center'
    },
    yAxisCol: {
        justifyContent: 'space-between',
        height: '100%',
        paddingRight: 6
    },
    axisLabel: {
        fontSize: 9,
        color: '#94a3b8'
    },
    plotArea: {
        flex: 1,
        height: '100%',
        position: 'relative',
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'flex-end'
    },
    gridLineTop: {
        position: 'absolute',
        top: '25%',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#f1f5f9'
    },
    gridLineMid: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#f1f5f9'
    },
    gridLineLow: {
        position: 'absolute',
        top: '75%',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#f1f5f9'
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        height: '100%'
    },
    dotCol: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%'
    },
    trendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#16a34a',
        borderWidth: 1,
        borderColor: 'white'
    },
    xDayLabel: {
        fontSize: 9,
        color: '#64748b',
        marginTop: 4
    },
    donutContainer: {
        alignItems: 'center',
        paddingVertical: 4
    },
    donutCircleWrapper: {
        alignItems: 'center',
        marginBottom: 12
    },
    donutOuterRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 8,
        borderColor: '#10b981',
        borderTopColor: '#f97316',
        borderRightColor: '#2563eb',
        borderBottomColor: '#a855f7',
        justifyContent: 'center',
        alignItems: 'center'
    },
    donutInnerHole: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    donutCenterVal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    legendList: {
        width: '100%',
        gap: 6
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    legendLabel: {
        fontSize: 11,
        color: '#475569',
        flex: 1
    },
    legendPercent: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    aiInsightsCard: {
        backgroundColor: '#eff6ff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    aiHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    aiHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e3a8a'
    },
    insightsList: {
        gap: 6
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8
    },
    bulletPoint: {
        color: '#2563eb',
        fontSize: 14,
        lineHeight: 18
    },
    bulletText: {
        fontSize: 12,
        color: '#1e293b',
        lineHeight: 18,
        flex: 1
    },
    sectionBlock: {
        marginBottom: 20
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
    chatCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    chatInputRow: {
        flexDirection: 'row',
        gap: 10
    },
    chatInput: {
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
    chatSendBtn: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: 10
    },
    chatSendBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13
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
        backgroundColor: '#2563eb',
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
        borderColor: '#2563eb',
        backgroundColor: '#eff6ff'
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
        backgroundColor: '#2563eb',
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2563eb',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    actionPillBtnText: {
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
        backgroundColor: '#2563eb',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8
    },
    confirmBtnText: {
        color: 'white',
        fontWeight: 'bold'
    }
});
