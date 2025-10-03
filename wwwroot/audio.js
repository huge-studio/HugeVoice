// Audio recording and playback functionality for HugeVox

let mediaRecorder = null;
let audioContext = null;
let audioWorklet = null;
let dotNetRef = null;

export async function startRecording(dotNetReference) {
    dotNetRef = dotNetReference;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                sampleSize: 16
            }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });

        const source = audioContext.createMediaStreamSource(stream);
        
        // Create a ScriptProcessorNode for audio processing
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = async function(event) {
            if (dotNetRef) {
                try {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const samples = new Int16Array(inputData.length);
                    
                    // Convert float32 to int16
                    for (let i = 0; i < inputData.length; i++) {
                        samples[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                    }
                    
                    // Convert to byte array and send as base64 string to avoid serialization issues
                    const bytes = new Uint8Array(samples.buffer);
                    const base64String = btoa(String.fromCharCode.apply(null, bytes));
                    
                    // Send to .NET
                    await dotNetRef.invokeMethodAsync('SendAudioData', base64String);
                } catch (error) {
                    console.error('Error processing audio data:', error);
                }
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log('Recording started');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
    }
}

export function stopRecording() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    dotNetRef = null;
    console.log('Recording stopped');
}

export async function activateAudioContext() {
    try {
        // Create or resume audio context with user interaction
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
        }
        
        // Resume audio context if it's suspended (required by browser autoplay policies)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        console.log('Audio context activated:', audioContext.state);
        return true;
    } catch (error) {
        console.error('Error activating audio context:', error);
        return false;
    }
}

export async function playAudio(audioData) {
    try {
        // Ensure we have an active audio context
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
        }

        // Resume audio context if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Convert base64 string back to byte array
        let bytes;
        if (typeof audioData === 'string') {
            // If it's a base64 string, decode it
            const binaryString = atob(audioData);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
        } else {
            // If it's already a byte array
            bytes = new Uint8Array(audioData);
        }

        const samples = new Int16Array(bytes.buffer);
        const floatSamples = new Float32Array(samples.length);
        
        // Convert int16 to float32
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = samples[i] / 0x7FFF;
        }

        const audioBuffer = audioContext.createBuffer(1, floatSamples.length, 16000);
        audioBuffer.getChannelData(0).set(floatSamples);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
        
    } catch (error) {
        console.error('Error playing audio:', error);
    }
}