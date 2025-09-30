import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Get your local IP address - replace with your actual IP
const BACKEND_URL = "http://10.10.21.195:8001";

export default function HomeScreen() {
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  const testConnection = async () => {
    setLoading(true);
    setConnectionStatus('Testing connection...');
    
    try {
      const response = await fetch(`${BACKEND_URL}/`);
      const data = await response.json();
      setConnectionStatus('✅ Connected successfully!');
      Alert.alert('Success', data.msg);
    } catch (error: any) {
      setConnectionStatus('❌ Connection failed');
      Alert.alert('Connection Error', 'Make sure the backend server is running on port 8001');
      console.error('Connection error:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPPG = async () => {
    setLoading(true);
    setConnectionStatus('Processing PPG signal...');
    
    try {
      const response = await fetch(`${BACKEND_URL}/process_ppg/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data.heart_rate);
      setConnectionStatus('✅ PPG processing completed!');
    } catch (error: any) {
      setConnectionStatus('❌ Processing failed');
      Alert.alert('Processing Error', 'Failed to process PPG signal');
      console.error('Processing error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🫀 NeoCare</Text>
            <Text style={styles.subtitle}>Heart Health Monitoring</Text>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{connectionStatus || 'Ready to connect'}</Text>
            {loading && <ActivityIndicator size="small" color="#667eea" style={styles.loader} />}
          </View>

          {/* Backend Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🌐 Backend Information</Text>
            <Text style={styles.infoText}>URL: {BACKEND_URL}</Text>
            <Text style={styles.infoText}>Status: Available on network</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.testButton]} 
              onPress={testConnection}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                🔗 Test Connection
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.ppgButton]} 
              onPress={processPPG}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? '⏳ Processing...' : '🫀 Process PPG'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Result Display */}
          {result !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>💓 Heart Rate Result</Text>
              <Text style={styles.resultValue}>{result} BPM</Text>
              <Text style={styles.resultSubtext}>Last measurement</Text>
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>📱 How to Use</Text>
            <Text style={styles.instructionsText}>
              1. Make sure your backend server is running{'\n'}
              2. Test the connection first{'\n'}
              3. Process PPG signal to get heart rate{'\n'}
              4. View results below
            </Text>
          </View>

        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  loader: {
    marginLeft: 10,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  ppgButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 15,
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  resultValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  resultSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  instructionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  instructionsText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
  },
});
