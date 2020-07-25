const divLanding = document.getElementById("divLanding");
const divSending = document.getElementById("divSending");
const divReceiving = document.getElementById("divReceiving");
const divSendingFileName = document.getElementById("divSendingFileName");
const divReceivingFileName = document.getElementById("divReceivingFileName");
const divSendingStatus = document.getElementById("divSendingStatus");
const divReceivingStatus = document.getElementById("divReceivingStatus");
const divShowFileCode = document.getElementById("divShowFileCode");
const divShowFileCodeWrapper = document.getElementById(
  "divShowFileCodeWrapper"
);
const divSentPercentWrapper = document.getElementById("divSentPercentWrapper");
const divSentPercent = document.getElementById("divSentPercent");

const btnChooseFile = document.getElementById("btnChooseFile");
const btnReceiveFile = document.getElementById("btnReceiveFile");
const btnSendSMS = document.getElementById("btnSendSMS");
const inputFileCode = document.getElementById("inputFileCode");
const inputFile = document.getElementById("inputFile");

const socket = io("https://callz.herokuapp.com");

let isSender,
  info,
  rtcPeerConnection,
  dataChannel,
  fileName,
  fileChunks = [];

const iceServers = {
  iceServer: [
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

// listening to choose file btn
btnChooseFile.onclick = () => {
  if (!window.navigator.onLine) {
    return swal("Offline!", "Device not connected to internet.", "error");
  }
  inputFile.click();
};

inputFile.addEventListener("change", () => {
  if (inputFile.files.length === 0) {
    return swal("No file chosen!", "", "error");
  }
  isSender = true;

  info = {
    fileName: inputFile.files[0].name,
    roomName: getFileCode(),
  };

  socket.emit("createOrJoin", info);
  fileName = inputFile.files[0].name;
  divSendingFileName.innerText = "File: " + inputFile.files[0].name;
  divShowFileCode.innerText = info.roomName;
  btnSendSMS.href =
    "sms:?body= Your file code for receiving a file is: " +
    info.roomName +
    ". Visit https://avinashvidyarthi.github.io/easy-share and enter code to download the file.";
  divLanding.style.display = "none";
  divSending.style.display = "block";
});

btnReceiveFile.onclick = () => {
  if (!window.navigator.onLine) {
    return swal("Offline!", "Device not connected to internet.", "error");
  }
  if (inputFileCode.value === "") {
    return swal("Empty file code!", "", "error");
  }
  btnReceiveFile.innerText = "Connecting..";
  btnReceiveFile.disabled = true;
  isSender = false;
  info = {
    roomName: inputFileCode.value,
  };
  socket.emit("createOrJoin", info);
};

socket.on("roomCreated", (infor) => {
  console.log("Room Created!");
  if (!isSender) {
    btnReceiveFile.innerText = "Receive file";
    btnReceiveFile.disabled = false;
    return swal("Invalid File Code!", "", "error");
  }
});

socket.on("roomJoined", (infor) => {
  console.log("Room Joined");
  if (isSender) {
    return;
  }
  divLanding.style.display = "none";
  divReceiving.style.display = "block";
  socket.emit("ready", info);
});

socket.on("ready", (infor) => {
  console.log("Ready");
  if (isSender) {
    divSendingStatus.innerText = "Status: Peer Connection Initialized";
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.onconnectionstatechange = stateListener;
    rtcPeerConnection.oniceconnectionstatechange = iceStateListener;
    dataChannel = rtcPeerConnection.createDataChannel(info.roomName, {
      ordered: true,
    });

    dataChannel.onmessage = (event) => {
      handelData(event.data);
    };

    dataChannel.onopen = () => {
      divShowFileCodeWrapper.style.display = "none";
      divSentPercentWrapper.style.display = "block";
      divSendingStatus.innerText = "Status: Transferring file...";
      sendFile();
      console.log("Data channel open");
    };

    rtcPeerConnection.createOffer().then((sessionDescription) => {
      rtcPeerConnection.setLocalDescription(sessionDescription);
      socket.emit("offer", {
        sdp: sessionDescription,
        info: info,
      });
    });
  }
});

socket.on("offer", (infor) => {
  console.log("Offer");
  if (!isSender) {
    fileName = infor.info.fileName;
    divReceivingFileName.innerText = "File: " + infor.info.fileName;
    divReceivingStatus.innerText = "Status: Peer Connection Initialized";
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.oniceconnectionstatechange = iceStateListener;
    rtcPeerConnection.onconnectionstatechange = stateListener;
    rtcPeerConnection.setRemoteDescription(
      new RTCSessionDescription(infor.sdp)
    );
    rtcPeerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.onmessage = (e) => {
        handelData(e.data);
      };

      dataChannel.onopen = () => {
        divReceivingStatus.innerText = "Status: Transferring file...";
        console.log("Data channel open");
      };
    };
    rtcPeerConnection.createAnswer().then((sessionDescription) => {
      rtcPeerConnection.setLocalDescription(sessionDescription);
      socket.emit("answer", {
        sdp: sessionDescription,
        info: info,
      });
    });
  }
});

socket.on("answer", (infor) => {
  divSendingStatus.innerText = "Status: Peer connected";
  console.log("Answer");
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(infor.sdp));
});

socket.on("candidate", (event) => {
  console.log("Ice Candidate");
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
    sdpMid: event.id,
  });
  rtcPeerConnection.addIceCandidate(candidate).then(()=>{
    console.log("ICE added successfully");
  }).catch((err)=>{
    console.log("Ice error");
    console.log(err);
  })
});

socket.on("roomFull", (info) => {
  swal("Room Full!", "Try other room!", "error");
});

function getFileCode() {
  return Math.floor(100000 + Math.random() * 900000);
}

function stateListener(event) {
  switch (rtcPeerConnection.connectionState) {
    case "connected": {
      console.log("Connected");
      break;
    }
    case "disconnected": {
      swal("Disconnected!", "Other user disconnected.", "error");
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      break;
    }
    case "failed": {
      console.log("failed");
      break;
    }
    case "closed": {
      window.location.reload();
      break;
    }
  }
}

function handelData(str) {
  if (isSender) {
    if (str === "fileReceived") {
      swal("File sent successfully!", "", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  } else {
    if (str === "done") {
      const fileReceived = new Blob(fileChunks);
      console.log("File Received!", fileReceived);
      download(fileReceived, fileName);
      swal("File Received!", "", "success");
      dataChannel.send("fileReceived");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      fileChunks.push(str);
    }
  }
}

function onIceCandidate(event) {
  console.log(event);
  if (event.candidate) {
    socket.emit("candidate", {
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
      info: info,
    });
  }
}

function sendFile() {
  const chunkSize = 16 * 1024;
  inputFile.files[0].arrayBuffer().then((buffer) => {
    let totalLength = buffer.byteLength;
    while (buffer.byteLength) {
      //   divSentPercent.innerText = ((totalLength-buffer.byteLength)/totalLength*100);
      divSentPercent.innerText = Math.random();
      dataChannel.send(buffer.slice(0, chunkSize));
      buffer = buffer.slice(chunkSize, buffer.byteLength);
    }
    dataChannel.send("done");
  });
}

function iceStateListener(event) {
  console.log(rtcPeerConnection.iceConnectionState);
}
