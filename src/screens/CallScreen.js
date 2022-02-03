import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Button, View, Pressable, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RTCPeerConnection, RTCView, mediaDevices, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import { db } from '../utilities/firebase';
import Entypo from 'react-native-vector-icons/Entypo';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const configuration = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function CallScreen({ setScreen, screens, roomId }) {

  function onBackPress() {
    if (cachedLocalPC) {
      cachedLocalPC.removeStream(localStream);
      cachedLocalPC.close();
    }
    setLocalStream();
    setRemoteStream();
    setCachedLocalPC();
    // cleanup
    setScreen(screens.ROOM);
  }

  const [localStream, setLocalStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [cachedLocalPC, setCachedLocalPC] = useState();

  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, isCameraOn] = useState(false);

  useEffect(() => {/* 
    const roomRef = db.collection('rooms').doc(123);
    const roomSnapshot = roomRef.get(); */
/*     console.log('database',roomSnapshot); */

    startLocalStream();
    console.log('room',roomId)
  /*   if(localStream){
     startCall(roomId);
    } */
  }, []);

  const startLocalStream = async () => {
    // isFront will determine if the initial camera should face user or environment
    const isFront = true;
    const devices = await mediaDevices.enumerateDevices();

    const facing = isFront ? 'front' : 'environment';
    const videoSourceId = devices.find(device => device.kind === 'videoinput' && device.facing === facing);
    const facingMode = isFront ? 'user' : 'environment';
    const constraints = {
      audio: true,
      video: {
        mandatory: {
          minWidth: 500, // Provide your own width, height and frame rate here
          minHeight: 300,
          minFrameRate: 30,
        },
        facingMode,
        optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
      },
    };
    const newStream = await mediaDevices.getUserMedia(constraints);
    console.log('localstream',newStream)
    setLocalStream(newStream);
  };

  const startCall = async id => {
    const localPC = new RTCPeerConnection(configuration);
    localPC.addStream(localStream);

    const roomRef = await db.collection('rooms').doc(id);
    const callerCandidatesCollection = roomRef.collection('callerCandidates');
    localPC.onicecandidate = e => {
      if (!e.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('e', e.candidate)

      callerCandidatesCollection.add(e.candidate.toJSON());
    };

    localPC.onaddstream = e => {
      if (e.stream && remoteStream !== e.stream) {
        console.log('RemotePC received the stream call', e.stream);
        setRemoteStream(e.stream);
      }
    };

    /* if callee disconnects call, caller will also disconnect */
    localPC.oniceconnectionstatechange = function(event) {
      if (localPC.iceConnectionState === "failed" ||
      localPC.iceConnectionState === "disconnected" ||
      localPC.iceConnectionState === "closed") {
        // Handle the failure
        onBackPress();
      }
    };
    const offer = await localPC.createOffer();
    await localPC.setLocalDescription(offer);

    const roomWithOffer = { offer };
    await roomRef.set(roomWithOffer);

    roomRef.onSnapshot(async snapshot => {
      const data = snapshot.data();
      if (!localPC.currentRemoteDescription && data.answer) {
        const rtcSessionDescription = new RTCSessionDescription(data.answer);
        await localPC.setRemoteDescription(rtcSessionDescription);
      }
    });

    roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          await localPC.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    setCachedLocalPC(localPC);
  };

  const switchCamera = () => {
    localStream.getVideoTracks().forEach(track =>{
      track._switchCamera()});
    isCameraOn(prev=>!prev);

  };

  // Mutes the local's outgoing audio
  const toggleMute = () => {
    if (!remoteStream) {
      return;
    }
    localStream.getAudioTracks().forEach(track => {
      // console.log(track.enabled ? 'muting' : 'unmuting', ' local track', track);
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    });
  };


  return (
    <>
      {/* <Text style={styles.heading} >Call Screen</Text>
      <Text style={styles.heading} >Room : {roomId}</Text> */}




      <View style={{ display: 'flex', flex: 1, padding: 10 }} >
        <View style={styles.rtcview}>
          {localStream && <RTCView style={styles.rtc} streamURL={localStream && localStream.toURL()} />}
        </View>
           <View style={styles.rtcview}>
          {remoteStream && <RTCView style={styles.rtc} streamURL={remoteStream && remoteStream.toURL()} />}
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {localStream && (
          <View style={styles.toggleButtons}>
            {/* <Button title='Switch camera' onPress={switchCamera} /> */}
            <TouchableOpacity onPress={switchCamera} style={[styles.iconButtonContainer, { backgroundColor: '#4a4a4a' }]}>
              <MaterialIcons
                name={isCameraOn ? 'camera-off' : 'camera'}
                size={25}
                color={'white'}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleMute} style={[styles.iconButtonContainer, { backgroundColor: '#4a4a4a' }]}>
              <MaterialIcons
                name={isMuted ? 'microphone-off' : 'microphone'}
                size={25}
                color={'white'}
              />
            </TouchableOpacity>
            {/*    <Button title={`${isMuted ? 'Unmute' : 'Mute'} stream`} onPress={toggleMute} disabled={!remoteStream} /> */}
          </View>
        )}
        <View style={styles.callButtons} >
          <TouchableOpacity onPress={onBackPress} >
            <View
              style={[styles.iconButtonContainer]}>
              <Feather name="x" color="white" size={25} />
            </View>
          </TouchableOpacity>
          {/*   <View styles={styles.buttonContainer} >
            <Button title="Click to stop call" onPress={onBackPress} />
          </View> */}
          <View styles={styles.buttonContainer} >
            {/*  {!localStream && <Button title='Click to start stream' onPress={startLocalStream} />} */}
            {localStream && <Button title='Click to start call' onPress={() => startCall(roomId)} disabled={!!remoteStream} />}
          </View>
        </View>

      </View>
    </>
  )
}

const styles = StyleSheet.create({
  heading: {
    alignSelf: 'center',
    fontSize: 30,
  },
  rtcview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    margin: 5,
  },
  rtc: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  iconButtonContainer: {
    backgroundColor: 'red',
    padding: 10,
    borderRadius: 50,
    margin: 5,
  },
  toggleButtons: {
    /*  width: '100%', */
    flexDirection: 'row',
    /*  justifyContent: 'space-around', */
  },
  callButtons: {
    /*   padding: 10,
      width: '100%', */
    flexDirection: 'row',
    /*   justifyContent: 'space-around', */
  },
  buttonContainer: {
    margin: 5,
  }
});
