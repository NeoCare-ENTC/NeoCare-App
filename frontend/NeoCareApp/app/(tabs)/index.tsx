import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

// Get your local IP address - replace with your actual IP
const BACKEND_URL = "http://10.10.21.195:8001";

type ScreenType = 'welcome' | 'auth' | 'upload' | 'analysis' | 'results';
type AnalysisType = 'heartrate' | 'respiratory' | 'spo2' | 'jaundice';

export default function HomeScreen() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('welcome');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisType[]>([]);
  const [videoFile, setVideoFile] = useState<any>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [videoMetadata, setVideoMetadata] = useState<{duration?: number; width?: number; height?: number} | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [results, setResults] = useState<any>(null);
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
      setResults({heartrate: data.heart_rate});
      setConnectionStatus('✅ PPG processing completed!');
    } catch (error: any) {
      setConnectionStatus('❌ Processing failed');
      Alert.alert('Processing Error', 'Failed to process PPG signal');
      console.error('Processing error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectVideoFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setVideoFile({ uri: asset.uri });
        
        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        setVideoInfo({
          name: asset.name || 'Unknown',
          size: fileInfo.exists ? (fileInfo as any).size || asset.size || 0 : 0,
          type: asset.mimeType || 'video/*',
        });
        
        console.log('Video selected:', asset);
      }
    } catch (err) {
      console.error('Error selecting video:', err);
      Alert.alert('Error', 'Failed to select video file');
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'web') {
      return true; // Web permissions handled in getUserMedia
    }
    
    if (!permission?.granted) {
      console.log('Requesting camera permission...');
      const result = await requestPermission();
      console.log('Permission result:', result);
      return result.granted;
    }
    return true;
  };

  const startCameraRecording = async () => {
    if (Platform.OS === 'web') {
      // Web camera recording using MediaRecorder API
      try {
        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            facingMode: 'user' // Front camera for web
          }, 
          audio: true 
        });
        
        console.log('Camera access granted, showing camera...');
        setShowCamera(true);
        
        // Store stream globally so we can access it in the video ref
        (window as any).cameraStream = stream;
        
        // Create MediaRecorder with fallback mime types
        let mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
          }
        }
        
        const recorder = new MediaRecorder(stream, { mimeType });
        
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
          console.log('Data available:', event.data.size);
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          console.log('Recording stopped, creating blob...');
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          
          // Set video file
          setVideoFile({ uri: url });
          setVideoInfo({
            name: 'Webcam Recording',
            size: blob.size,
            type: mimeType,
          });
          
          setShowCamera(false);
          setIsRecording(false);
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          (window as any).cameraStream = null;
        };
        
        setMediaRecorder(recorder);
        setRecordedChunks(chunks);
        
      } catch (error) {
        console.error('Web camera error:', error);
        Alert.alert('Camera Error', `Unable to access webcam: ${(error as Error).message}. Please allow camera permission.`);
      }
      return;
    }
    
    // Mobile camera recording
    console.log('Starting mobile camera recording...');
    const hasPermission = await requestCameraPermission();
    console.log('Has camera permission:', hasPermission);
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is needed to record video. Please enable it in your device settings.');
      return;
    }
    
    console.log('Showing camera...');
    setShowCamera(true);
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      // Web recording
      if (mediaRecorder && !isRecording) {
        setIsRecording(true);
        setRecordedChunks([]);
        mediaRecorder.start();
        
        // Auto-stop after 60 seconds
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            stopRecording();
          }
        }, 60000);
      }
    } else {
      // Mobile recording
      if (cameraRef && !isRecording) {
        try {
          console.log('Starting mobile recording...');
          setIsRecording(true);
          
          const video = await cameraRef.recordAsync({
            quality: '720p', // Changed to 720p for better compatibility
            maxDuration: 60, // 60 seconds max
          });
          
          console.log('Recording completed:', video);
          
          // Save to device media library
          try {
            const asset = await MediaLibrary.createAssetAsync(video.uri);
            console.log('Asset created:', asset);
          } catch (mediaError) {
            console.log('Media library save failed:', mediaError);
            // Continue even if saving to media library fails
          }
          
          // Set video file
          setVideoFile({ uri: video.uri });
          
          const fileInfo = await FileSystem.getInfoAsync(video.uri);
          setVideoInfo({
            name: 'Mobile Recording',
            size: fileInfo.exists ? (fileInfo as any).size || 0 : 0,
            type: 'video/mp4',
          });
          
          setShowCamera(false);
          setIsRecording(false);
          console.log('Video set successfully');
          
        } catch (error) {
          console.error('Mobile recording failed:', error);
          Alert.alert('Recording Error', `Failed to record video: ${(error as Error).message}`);
          setIsRecording(false);
        }
      } else {
        console.log('Cannot start recording - cameraRef:', cameraRef, 'isRecording:', isRecording);
      }
    }
  };

  const stopRecording = async () => {
    if (Platform.OS === 'web') {
      // Web stop recording
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
    } else {
      // Mobile stop recording
      if (cameraRef && isRecording) {
        try {
          await cameraRef.stopRecording();
          setIsRecording(false);
        } catch (error) {
          console.error('Stop recording failed:', error);
        }
      }
    }
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getVideoSpecs = () => {
    if (!videoInfo) return null;
    
    return {
      duration: videoMetadata?.duration ? `${videoMetadata.duration}s` : 'Loading...',
      fps: '30 FPS (estimated)', // Could be detected from video analysis
      resolution: videoMetadata?.width && videoMetadata?.height 
        ? `${videoMetadata.width}x${videoMetadata.height}` 
        : 'Loading...',
      format: videoInfo.type || 'Unknown'
    };
  };

  const renderWelcomeScreen = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🫀 NeoCare</Text>
        <Text style={styles.subtitle}>Vital Signs Monitoring System</Text>
      </View>
      
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome to NeoCare</Text>
        <Text style={styles.welcomeDescription}>
          Advanced vital signs monitoring system based on rPPG (remote Photoplethysmography) signals.
          {'\n\n'}Monitor your health through video analysis:
          {'\n'}• Heart Rate Detection
          {'\n'}• Respiratory Rate Analysis  
          {'\n'}• SpO2 Estimation
          {'\n'}• Jaundice Status Detection
          {'\n\n'}All rights reserved © NeoCare 2025
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={() => setCurrentScreen('auth')}
        >
          <Text style={styles.buttonText}>🚀 Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAuthScreen = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Welcome Back</Text>
        <Text style={styles.subtitle}>Login or Sign Up to Continue</Text>
      </View>
      
      <View style={styles.authCard}>
        <Text style={styles.authNote}>
          For demonstration purposes, authentication is currently disabled.
          {'\n'}Click any option below to continue.
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.loginButton]} 
          onPress={() => setCurrentScreen('upload')}
        >
          <Text style={styles.buttonText}>📱 Login</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.signupButton]} 
          onPress={() => setCurrentScreen('upload')}
        >
          <Text style={styles.buttonText}>✨ Sign Up</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.skipButton]} 
          onPress={() => setCurrentScreen('upload')}
        >
          <Text style={styles.buttonText}>⏭️ Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUploadScreen = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>📹 Upload Video</Text>
        <Text style={styles.subtitle}>Select video for vital signs analysis</Text>
      </View>
      
      <View style={styles.requirementsCard}>
        <Text style={styles.requirementsTitle}>📋 Video Requirements</Text>
        <Text style={styles.requirementsText}>
          • Frame Rate: 30 FPS (recommended)
          {'\n'}• Resolution: 1080p or higher
          {'\n'}• Duration: 30-60 seconds
          {'\n'}• Good lighting conditions
          {'\n'}• Face clearly visible
          {'\n'}• Minimal movement
        </Text>
      </View>
      
      <View style={styles.uploadSection}>
        {!videoFile ? (
          <View style={styles.uploadOptions}>
            {/* Camera Recording Option - Available on all platforms */}
            <TouchableOpacity 
              style={[styles.uploadButton, styles.cameraButton]}
              onPress={startCameraRecording}
            >
              <Text style={styles.uploadIcon}>📹</Text>
              <Text style={styles.uploadButtonText}>
                {Platform.OS === 'web' ? 'Record with Webcam' : 'Record Video'}
              </Text>
              <Text style={styles.uploadSubtext}>
                {Platform.OS === 'web' ? 'Use your webcam to record' : 'Use camera to record'}
              </Text>
            </TouchableOpacity>
            
            {/* File Selection Option */}
            <TouchableOpacity 
              style={[styles.uploadButton, styles.fileButton]}
              onPress={selectVideoFile}
            >
              <Text style={styles.uploadIcon}>📁</Text>
              <Text style={styles.uploadButtonText}>
                {Platform.OS === 'web' ? 'Choose Video File' : 'Select from Gallery'}
              </Text>
              <Text style={styles.uploadSubtext}>
                Browse {Platform.OS === 'web' ? 'saved files' : 'saved videos'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.videoContainer}>
            {/* Video Preview */}
            <View style={styles.videoPreview}>
              <Video
                source={{ uri: videoFile.uri }}
                style={styles.video}
                useNativeControls={true}
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                shouldPlay={false}
                onLoad={(status) => {
                  if (status.isLoaded) {
                    setVideoMetadata({
                      duration: status.durationMillis ? Math.round(status.durationMillis / 1000) : undefined,
                      width: (status as any).naturalSize?.width || 1920,
                      height: (status as any).naturalSize?.height || 1080,
                    });
                  }
                }}
                onError={(error) => {
                  console.error('Video loading error:', error);
                  Alert.alert('Video Error', 'Failed to load video file');
                }}
              />
              {Platform.OS === 'web' && (
                <View style={styles.videoOverlay}>
                  <Text style={styles.videoOverlayText}>Click to play</Text>
                </View>
              )}
            </View>
            
            {/* Video Information */}
            <View style={styles.videoInfoCard}>
              <Text style={styles.videoInfoTitle}>📹 Video Information</Text>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Name:</Text>
                <Text style={styles.videoInfoValue} numberOfLines={1}>
                  {videoInfo?.name || 'Unknown'}
                </Text>
              </View>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Size:</Text>
                <Text style={styles.videoInfoValue}>
                  {videoInfo?.size ? formatFileSize(videoInfo.size) : 'Unknown'}
                </Text>
              </View>
                            <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Duration:</Text>
                <Text style={styles.videoInfoValue}>
                  {videoMetadata?.duration ? `${videoMetadata.duration}s` : 'Auto-detected'}
                </Text>
              </View>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Resolution:</Text>
                <Text style={styles.videoInfoValue}>
                  {videoMetadata?.width && videoMetadata?.height 
                    ? `${videoMetadata.width}x${videoMetadata.height}` 
                    : 'HD Quality'}
                </Text>
              </View>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Frame Rate:</Text>
                <Text style={styles.videoInfoValue}>30 FPS</Text>
              </View>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Format:</Text>
                <Text style={styles.videoInfoValue}>
                  {videoInfo?.type?.replace('video/', '').toUpperCase() || 'MP4'}
                </Text>
              </View>
            </View>
            
            {/* Ready Status */}
            <View style={styles.uploadSuccessCard}>
              <Text style={styles.uploadSuccessIcon}>✅</Text>
              <Text style={styles.uploadSuccessText}>Video ready for analysis!</Text>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.videoActionButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.changeVideoButton]}
                onPress={() => {
                  setVideoFile(null);
                  setVideoInfo(null);
                  setVideoMetadata(null);
                }}
              >
                <Text style={styles.buttonText}>🔄 Change Video</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.continueButton]}
                onPress={() => setCurrentScreen('analysis')}
              >
                <Text style={styles.buttonText}>➡️ Continue to Analysis</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      
      <TouchableOpacity 
        style={[styles.button, styles.backButton]} 
        onPress={() => setCurrentScreen('auth')}
      >
        <Text style={styles.buttonText}>⬅️ Back</Text>
      </TouchableOpacity>

      {/* Camera Modal */}
      {showCamera && (
        <View style={styles.cameraModal}>
          <View style={styles.cameraContainer}>
            {Platform.OS === 'web' ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {/* Web camera preview */}
                <video
                  ref={(video) => {
                    if (video) {
                      // Set source immediately if stream exists
                      if ((window as any).cameraStream) {
                        console.log('Setting video source...');
                        video.srcObject = (window as any).cameraStream;
                        video.play().then(() => {
                          console.log('Video playing successfully');
                        }).catch(err => {
                          console.error('Video play error:', err);
                        });
                      } else {
                        // Wait a bit and try again
                        setTimeout(() => {
                          if ((window as any).cameraStream) {
                            video.srcObject = (window as any).cameraStream;
                            video.play();
                          }
                        }, 500);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#000',
                    borderRadius: 12,
                    objectFit: 'cover',
                  }}
                  muted
                  autoPlay
                  playsInline
                />
                {/* Loading indicator for web */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'white',
                  fontSize: '16px',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}>
                  📹 Starting camera...
                </div>
              </div>
            ) : (
              // Mobile camera
              <CameraView
                style={styles.camera}
                facing="back"
                ref={(ref) => {
                  console.log('Camera ref set:', ref);
                  setCameraRef(ref);
                }}
              />
            )}
            
            <View style={styles.cameraControls}>
              <TouchableOpacity 
                style={[styles.cameraButton, styles.cancelButton]}
                onPress={() => {
                  setShowCamera(false);
                  setIsRecording(false);
                  if (Platform.OS === 'web' && mediaRecorder?.stream) {
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                  }
                }}
              >
                <Text style={styles.cameraButtonText}>❌ Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.cameraButton, styles.recordButton, isRecording && styles.recordingButton]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Text style={styles.cameraButtonText}>
                  {isRecording ? '⏹️ Stop Recording' : '🔴 Start Recording'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingText}>🔴 Recording...</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );

  const toggleAnalysisSelection = (type: AnalysisType) => {
    setSelectedAnalysis(prev => 
      prev.includes(type) 
        ? prev.filter(item => item !== type)
        : [...prev, type]
    );
  };

  const renderAnalysisScreen = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🔬 Select Analysis</Text>
        <Text style={styles.subtitle}>Choose what to predict from your video</Text>
      </View>
      
      <View style={styles.analysisGrid}>
        <TouchableOpacity 
          style={[
            styles.analysisCard, 
            selectedAnalysis.includes('heartrate') && styles.analysisCardSelected
          ]}
          onPress={() => toggleAnalysisSelection('heartrate')}
        >
          <Text style={styles.analysisIcon}>💓</Text>
          <Text style={styles.analysisTitle}>Heart Rate</Text>
          <Text style={styles.analysisDescription}>BPM measurement from facial blood flow</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.analysisCard, 
            selectedAnalysis.includes('respiratory') && styles.analysisCardSelected
          ]}
          onPress={() => toggleAnalysisSelection('respiratory')}
        >
          <Text style={styles.analysisIcon}>🫁</Text>
          <Text style={styles.analysisTitle}>Respiratory Rate</Text>
          <Text style={styles.analysisDescription}>Breathing rate detection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.analysisCard, 
            selectedAnalysis.includes('spo2') && styles.analysisCardSelected
          ]}
          onPress={() => toggleAnalysisSelection('spo2')}
        >
          <Text style={styles.analysisIcon}>🩸</Text>
          <Text style={styles.analysisTitle}>SpO2 Level</Text>
          <Text style={styles.analysisDescription}>Blood oxygen saturation</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.analysisCard, 
            selectedAnalysis.includes('jaundice') && styles.analysisCardSelected
          ]}
          onPress={() => toggleAnalysisSelection('jaundice')}
        >
          <Text style={styles.analysisIcon}>👁️</Text>
          <Text style={styles.analysisTitle}>Jaundice Detection</Text>
          <Text style={styles.analysisDescription}>Separate AI model for status detection</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.analyzeButton,
            selectedAnalysis.length === 0 && styles.buttonDisabled
          ]} 
          onPress={() => {
            if (selectedAnalysis.length > 0) {
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                setResults({
                  heartrate: selectedAnalysis.includes('heartrate') ? 72 : null,
                  respiratory: selectedAnalysis.includes('respiratory') ? 16 : null,
                  spo2: selectedAnalysis.includes('spo2') ? 98 : null,
                  jaundice: selectedAnalysis.includes('jaundice') ? 'Normal' : null,
                });
                setCurrentScreen('results');
              }, 3000);
            }
          }}
          disabled={selectedAnalysis.length === 0 || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '⏳ Analyzing...' : '🔍 Start Analysis'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.backButton]} 
          onPress={() => setCurrentScreen('upload')}
        >
          <Text style={styles.buttonText}>⬅️ Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResultsScreen = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Analysis Results</Text>
        <Text style={styles.subtitle}>Your vital signs analysis is complete</Text>
      </View>
      
      <ScrollView style={styles.resultsContainer}>
        {results?.heartrate && (
          <View style={[styles.resultCard, styles.heartrateResult]}>
            <Text style={styles.resultIcon}>💓</Text>
            <Text style={styles.resultTitle}>Heart Rate</Text>
            <Text style={styles.resultValue}>{results.heartrate} BPM</Text>
            <Text style={styles.resultStatus}>Normal Range</Text>
          </View>
        )}
        
        {results?.respiratory && (
          <View style={[styles.resultCard, styles.respiratoryResult]}>
            <Text style={styles.resultIcon}>🫁</Text>
            <Text style={styles.resultTitle}>Respiratory Rate</Text>
            <Text style={styles.resultValue}>{results.respiratory} breaths/min</Text>
            <Text style={styles.resultStatus}>Normal Range</Text>
          </View>
        )}
        
        {results?.spo2 && (
          <View style={[styles.resultCard, styles.spo2Result]}>
            <Text style={styles.resultIcon}>🩸</Text>
            <Text style={styles.resultTitle}>SpO2 Level</Text>
            <Text style={styles.resultValue}>{results.spo2}%</Text>
            <Text style={styles.resultStatus}>Excellent</Text>
          </View>
        )}
        
        {results?.jaundice && (
          <View style={[styles.resultCard, styles.jaundiceResult]}>
            <Text style={styles.resultIcon}>👁️</Text>
            <Text style={styles.resultTitle}>Jaundice Status</Text>
            <Text style={styles.resultValue}>{results.jaundice}</Text>
            <Text style={styles.resultStatus}>No concerns detected</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.newAnalysisButton]} 
          onPress={() => {
            setCurrentScreen('upload');
            setSelectedAnalysis([]);
            setResults(null);
            setUploadProgress(0);
          }}
        >
          <Text style={styles.buttonText}>🔄 New Analysis</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.homeButton]} 
          onPress={() => {
            setCurrentScreen('welcome');
            setSelectedAnalysis([]);
            setResults(null);
            setUploadProgress(0);
          }}
        >
          <Text style={styles.buttonText}>🏠 Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'welcome': return renderWelcomeScreen();
      case 'auth': return renderAuthScreen();
      case 'upload': return renderUploadScreen();
      case 'analysis': return renderAnalysisScreen();
      case 'results': return renderResultsScreen();
      default: return renderWelcomeScreen();
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderCurrentScreen()}
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
  
  // Welcome Screen Styles
  welcomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 25,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  welcomeDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
    textAlign: 'center',
  },
  
  // Auth Screen Styles
  authCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  authNote: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Upload Screen Styles
  requirementsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
  },
  requirementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  requirementsText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  uploadSection: {
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: Platform.OS === 'web' ? 20 : 25,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: Platform.OS === 'web' ? 0 : 15,
    minHeight: Platform.OS === 'web' ? 120 : 'auto',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginTop: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Analysis Screen Styles
  analysisGrid: {
    gap: 15,
    marginBottom: 30,
  },
  analysisCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  analysisCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  analysisIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  analysisDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  
  // Results Screen Styles
  resultsContainer: {
    maxHeight: 400,
    marginBottom: 20,
  },
  resultIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  resultStatus: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  heartrateResult: {
    borderColor: '#E91E63',
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
  },
  respiratoryResult: {
    borderColor: '#2196F3',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  spo2Result: {
    borderColor: '#FF5722',
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
  },
  jaundiceResult: {
    borderColor: '#FF9800',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
  },
  
  // Button Styles
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
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  loginButton: {
    backgroundColor: '#2196F3',
  },
  signupButton: {
    backgroundColor: '#FF5722',
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  analyzeButton: {
    backgroundColor: '#673AB7',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.5,
  },
  newAnalysisButton: {
    backgroundColor: '#4CAF50',
  },
  homeButton: {
    backgroundColor: '#2196F3',
  },
  
  // Results specific
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#7C7C7C',
    textAlign: 'center',
    marginTop: 8,
  },
  videoContainer: {
    width: '100%',
  },
  videoPreview: {
    width: '100%',
    height: Platform.OS === 'web' ? 300 : 250,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
  },
  videoInfoCard: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: 'rgba(52, 152, 219, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  videoInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
  },
  videoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    flex: 0.4,
  },
  videoInfoValue: {
    fontSize: 14,
    color: '#2C3E50',
    flex: 0.6,
    textAlign: 'right',
  },
  videoActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  changeVideoButton: {
    backgroundColor: 'rgba(241, 196, 15, 0.1)',
    borderColor: '#F1C40F',
    flex: 1,
  },
  continueButton: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderColor: '#2ECC71',
    flex: 1,
  },
  uploadInProgressButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: '#3498DB',
    flex: 1,
  },
  uploadSuccessCard: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadSuccessIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadSuccessText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
    textAlign: 'center',
  },
  uploadOptions: {
    width: '100%',
    gap: 16,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
  },
  cameraButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: '#E74C3C',
    flex: Platform.OS === 'web' ? 1 : undefined,
    marginRight: Platform.OS === 'web' ? 8 : 0,
  },
  fileButton: {
    backgroundColor: 'rgba(72, 187, 120, 0.1)',
    borderColor: '#48BB78',
    flex: Platform.OS === 'web' ? 1 : undefined,
    marginLeft: Platform.OS === 'web' ? 8 : 0,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoOverlayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  cameraContainer: {
    width: '90%',
    height: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recordButton: {
    backgroundColor: '#E74C3C',
  },
  recordingButton: {
    backgroundColor: '#C0392B',
  },
  cancelButton: {
    backgroundColor: '#7F8C8D',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  recordingText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
