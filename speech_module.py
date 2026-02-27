import speech_recognition as sr
import threading
import time
from collections import deque

class ATCAudioObserver:
    """
    Listens to pilot audio and keeps a temporal buffer of requests.
    """
    def __init__(self, buffer_size=10):
        self.recognizer = sr.Recognizer()
        self.request_history = deque(maxlen=buffer_size) 
        self.last_heard = "NONE"
        self.is_listening = False

    def _listen_loop(self):
        # We try to use the default mic (which should be set to Stereo Mix on the user's PC)
        with sr.Microphone() as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
            
            while self.is_listening:
                try:
                    audio = self.recognizer.listen(source, timeout=3, phrase_time_limit=5)
                    text = self.recognizer.recognize_google(audio).upper()
                    
                    # Store with timestamp for 'Intent Linking'
                    entry = {"text": text, "time": time.time()}
                    self.request_history.append(entry)
                    self.last_heard = text
                    
                except (sr.WaitTimeoutError, sr.UnknownValueError):
                    continue
                except Exception:
                    time.sleep(1)

    def get_recent_intents(self, window_seconds=15):
        """Returns all heard requests in the last X seconds."""
        now = time.time()
        return [r["text"] for r in self.request_history if now - r["time"] < window_seconds]

    def start(self):
        self.is_listening = True
        self.thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_listening = False
