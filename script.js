document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    
    const recordBtn = document.getElementById('record-btn');
    const clearBtn = document.getElementById('clear-btn');
    const recordingStatus = document.getElementById('recording-status');
    const recordingPulse = document.getElementById('recording-pulse');
    
    const swapBtn = document.getElementById('swap-lang-btn');
    const speakBtn = document.getElementById('speak-btn');
    const copyBtn = document.getElementById('copy-btn');
    const translatingStatus = document.getElementById('translating-status');

    // Speech Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onstart = () => {
            isRecording = true;
            recordBtn.classList.add('recording');
            recordingPulse.classList.remove('hidden');
            recordingStatus.textContent = 'Listening...';
            recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Update text area
            const currentText = sourceText.value;
            // A somewhat simplistic way to handle continuous text updates
            // In a real app we might want to manage the caret position carefully
            if (finalTranscript) {
                // If it's a new sentence, space it out
                sourceText.value = currentText ? currentText + ' ' + finalTranscript : finalTranscript;
                triggerTranslation();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            stopRecording();
            recordingStatus.textContent = 'Error: ' + event.error;
            setTimeout(() => { recordingStatus.textContent = 'Ready'; }, 3000);
        };

        recognition.onend = () => {
            stopRecording();
        };
    } else {
        recordingStatus.textContent = 'Speech Recognition Not Supported';
        recordBtn.disabled = true;
        recordBtn.style.opacity = '0.5';
        recordBtn.title = "Your browser does not support Speech Recognition. Try Chrome.";
    }

    function toggleRecording() {
        if (!recognition) return;
        
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.lang = sourceLang.value;
            sourceText.value = ''; // Clear previous text on new record
            targetText.value = '';
            recognition.start();
        }
    }

    function stopRecording() {
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordingPulse.classList.add('hidden');
        recordingStatus.textContent = 'Ready';
        recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }

    recordBtn.addEventListener('click', toggleRecording);

    // Swap Languages
    swapBtn.addEventListener('click', () => {
        // Swap select values
        const tempLang = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = tempLang;

        // Swap text content
        const tempText = sourceText.value;
        sourceText.value = targetText.value;
        targetText.value = tempText;

        // Stop recording if active
        if (isRecording) {
            recognition.stop();
        }

        // Add a nice rotation animation class temporarily
        swapBtn.style.transform = 'rotate(180deg)';
        setTimeout(() => {
            swapBtn.style.transition = 'none';
            swapBtn.style.transform = 'rotate(0deg)';
            setTimeout(() => {
                swapBtn.style.transition = 'all 0.2s ease';
            }, 50);
        }, 300);
    });

    // Translation Logic (using MyMemory API)
    // Debounce translation to avoid hitting API limits while typing
    let translationTimeout;
    
    function triggerTranslation() {
        clearTimeout(translationTimeout);
        const text = sourceText.value.trim();
        
        if (!text) {
            targetText.value = '';
            return;
        }

        translatingStatus.classList.remove('hidden');
        
        translationTimeout = setTimeout(async () => {
            const src = sourceLang.value.split('-')[0]; // MyMemory prefers simple lang codes like 'en'
            const tgt = targetLang.value.split('-')[0];
            
            try {
                // api.mymemory.translated.net/get?q=Hello World!&langpair=en|it
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`);
                const data = await response.json();
                
                if (data.responseData && data.responseData.translatedText) {
                    targetText.value = data.responseData.translatedText;
                } else {
                    targetText.value = "Translation error.";
                }
            } catch (error) {
                console.error("Translation API Error:", error);
                targetText.value = "Network error. Could not translate.";
            } finally {
                translatingStatus.classList.add('hidden');
            }
        }, 800); // 800ms debounce
    }

    sourceText.addEventListener('input', triggerTranslation);
    sourceLang.addEventListener('change', triggerTranslation);
    targetLang.addEventListener('change', triggerTranslation);

    // Text to Speech
    let availableVoices = [];
    if ('speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            availableVoices = window.speechSynthesis.getVoices();
        };
    }

    speakBtn.addEventListener('click', () => {
        const text = targetText.value.trim();
        if (!text) return;

        if ('speechSynthesis' in window) {
            // If already speaking, cancel it
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }

            // Small delay to prevent Chrome cancel() bug where subsequent speak() is ignored
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = targetLang.value; // e.g., kn-IN
                
                // Try to find a specific voice for the target language to improve reliability
                const targetLangCode = targetLang.value.split('-')[0]; // 'en', 'kn', or 'hi'
                const langNameMap = { 'en': 'english', 'kn': 'kannada', 'hi': 'hindi' };
                const langName = langNameMap[targetLangCode];

                let voice = availableVoices.find(v => v.lang === targetLang.value || v.lang.replace('_', '-').toLowerCase() === targetLang.value.toLowerCase());
                
                if (!voice) {
                    voice = availableVoices.find(v => v.lang.startsWith(targetLangCode));
                }
                
                if (!voice && langName) {
                    // Fallback to searching by voice name (useful for Chrome's "Google हिन्दी" etc.)
                    voice = availableVoices.find(v => v.name.toLowerCase().includes(langName) || (targetLangCode === 'hi' && v.name.includes('हिन्दी')));
                }

                if (voice) {
                    utterance.voice = voice;
                }
                
                // Highlight button while speaking
                speakBtn.style.color = 'var(--primary)';
                
                utterance.onend = () => {
                    speakBtn.style.color = '';
                };
                
                utterance.onerror = (e) => {
                    console.error("SpeechSynthesis Error:", e);
                    speakBtn.style.color = '';
                };

                window.speechSynthesis.speak(utterance);
            }, 50);
        } else {
            alert('Text-to-Speech is not supported in your browser.');
        }
    });

    // Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        const text = targetText.value.trim();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            // Provide visual feedback
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            copyBtn.style.color = 'var(--success)';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
                copyBtn.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    });

    // Clear Text
    clearBtn.addEventListener('click', () => {
        sourceText.value = '';
        targetText.value = '';
        
        // Visual feedback
        const originalIcon = clearBtn.innerHTML;
        clearBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        clearBtn.style.color = 'var(--success)';
        
        setTimeout(() => {
            clearBtn.innerHTML = originalIcon;
            clearBtn.style.color = '';
        }, 1000);
    });
});
