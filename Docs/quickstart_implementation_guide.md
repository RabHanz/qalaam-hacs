# Quick-Start Implementation Guide
## From Zero to Working Prototype in 48 Hours

This guide gets you from nothing to a working voice cloning demo as fast as possible.

---

## Day 1: Setup & First Voice Clone

### Hour 1-2: Environment Setup

```bash
# Create project directory
mkdir quranic-recitation-ai
cd quranic-recitation-ai

# Create Python environment
conda create -n quranic python=3.11 -y
conda activate quranic

# Install core dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install git+https://github.com/SWivid/F5-TTS.git
pip install datasets librosa soundfile scipy
pip install fastapi uvicorn python-multipart
pip install openai-whisper  # For ASR later
```

### Hour 3-4: Download Dataset

```python
# download_dataset.py
from datasets import load_dataset
import os

print("Downloading EveryAyah dataset...")
dataset = load_dataset("tarteel-ai/everyayah")

# Save locally
dataset.save_to_disk("./data/everyayah")
print("Dataset downloaded!")

# Quick stats
print(f"Total samples: {len(dataset['train'])}")
print(f"Reciters: {set(dataset['train']['reciter'])}")
```

### Hour 5-6: Extract Voice Samples

```python
# extract_voice_samples.py
from datasets import load_dataset
import soundfile as sf
import os

dataset = load_dataset("./data/everyayah")

# Top 5 reciters to start with
target_reciters = [
    "abdul_basit",
    "alafasy", 
    "husary",
    "abdurrahmaan_as-sudais",
    "minshawi"
]

os.makedirs("voice_samples", exist_ok=True)

for reciter in target_reciters:
    print(f"Processing {reciter}...")
    
    # Get first 20 samples from this reciter
    samples = dataset['train'].filter(
        lambda x: x['reciter'] == reciter
    ).select(range(20))
    
    # Concatenate to create 15-20 second reference
    all_audio = []
    for sample in samples:
        all_audio.extend(sample['audio']['array'])
        if len(all_audio) > 16000 * 20:  # 20 seconds at 16kHz
            break
    
    # Save
    output_path = f"voice_samples/{reciter}_reference.wav"
    sf.write(output_path, all_audio[:16000*20], 16000)
    print(f"Saved: {output_path}")
```

### Hour 7-8: First Voice Clone Test

```python
# test_voice_clone.py
from TTS.api import TTS
import soundfile as sf

# Initialize XTTS-v2 (easier to start than F5-TTS)
print("Loading XTTS model...")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)

# Test with Abdul Basit
test_text = "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ"

print("Generating audio...")
output = tts.tts_to_file(
    text=test_text,
    speaker_wav="voice_samples/abdul_basit_reference.wav",
    language="ar",
    file_path="output_bismillah.wav"
)

print("✅ Audio generated: output_bismillah.wav")
print("Listen to it and evaluate quality!")
```

**⚠️ Checkpoint:** Listen to the output. Does it sound like Abdul Basit? If yes, proceed. If no, try:
- Different reciter samples
- Longer reference audio (30s instead of 20s)
- Adjusting XTTS parameters

---

## Day 2: Build Web Interface

### Hour 9-10: FastAPI Backend

```python
# backend/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from TTS.api import TTS
import tempfile
import os

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)

RECITERS = {
    "abdul_basit": "voice_samples/abdul_basit_reference.wav",
    "alafasy": "voice_samples/alafasy_reference.wav",
    "husary": "voice_samples/husary_reference.wav",
    "sudais": "voice_samples/abdurrahmaan_as-sudais_reference.wav",
    "minshawi": "voice_samples/minshawi_reference.wav"
}

@app.get("/")
def root():
    return {"status": "Quranic AI Backend Running"}

@app.get("/reciters")
def list_reciters():
    return {"reciters": list(RECITERS.keys())}

@app.post("/generate")
async def generate_voice(
    text: str,
    reciter: str = "abdul_basit"
):
    """Generate Quranic verse in specified reciter's voice"""
    
    if reciter not in RECITERS:
        return {"error": f"Reciter {reciter} not found"}
    
    # Generate audio
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        output_path = tmp.name
    
    tts.tts_to_file(
        text=text,
        speaker_wav=RECITERS[reciter],
        language="ar",
        file_path=output_path
    )
    
    return FileResponse(
        output_path,
        media_type="audio/wav",
        filename=f"{reciter}_{text[:20]}.wav"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Run backend:
```bash
python backend/main.py
```

Test in browser: http://localhost:8000/reciters

### Hour 11-12: Next.js Frontend

```bash
# Create Next.js app
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
npm install lucide-react
```

```typescript
// frontend/app/page.tsx
'use client'

import { useState } from 'react'
import { Play, Download, Volume2 } from 'lucide-react'

const RECITERS = [
  { id: 'abdul_basit', name: 'Abdul Basit Abdus Samad' },
  { id: 'alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'sudais', name: 'Abdurrahman As-Sudais' },
  { id: 'minshawi', name: 'Muhammad Siddiq Al-Minshawi' }
]

const COMMON_VERSES = [
  { id: '1:1', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', name: 'Bismillah' },
  { id: '1:2', text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', name: 'Al-Fatiha Verse 2' },
  { id: '112:1', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', name: 'Al-Ikhlas' },
  { id: '2:255', text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', name: 'Ayat al-Kursi' }
]

export default function Home() {
  const [selectedReciter, setSelectedReciter] = useState('abdul_basit')
  const [selectedVerse, setSelectedVerse] = useState('1:1')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const verse = COMMON_VERSES.find(v => v.id === selectedVerse)
      const response = await fetch(
        `http://localhost:8000/generate?text=${encodeURIComponent(verse!.text)}&reciter=${selectedReciter}`
      )
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 text-emerald-900">
          Quranic Recitation AI
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Clone any reciter's voice - Powered by AI
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Reciter Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Reciter
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {RECITERS.map(reciter => (
                <button
                  key={reciter.id}
                  onClick={() => setSelectedReciter(reciter.id)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedReciter === reciter.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <Volume2 className="w-5 h-5 mb-2 mx-auto" />
                  <div className="text-sm font-medium">{reciter.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Verse Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Verse
            </label>
            <select
              value={selectedVerse}
              onChange={(e) => setSelectedVerse(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none"
            >
              {COMMON_VERSES.map(verse => (
                <option key={verse.id} value={verse.id}>
                  {verse.name} - {verse.text}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Generate Recitation
              </>
            )}
          </button>

          {/* Audio Player */}
          {audioUrl && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-4">Generated Audio:</h3>
              <audio src={audioUrl} controls className="w-full mb-4" />
              <a
                href={audioUrl}
                download={`recitation_${selectedReciter}.wav`}
                className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <Download className="w-4 h-4" />
                Download Audio
              </a>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8 text-center">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-emerald-600">5</div>
            <div className="text-sm text-gray-600">Reciters</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-emerald-600">6236</div>
            <div className="text-sm text-gray-600">Verses Available</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-3xl font-bold text-emerald-600">∞</div>
            <div className="text-sm text-gray-600">Generations</div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Run frontend:
```bash
cd frontend
npm run dev
```

Visit: http://localhost:3000

---

## Hour 13-16: Test & Refine

### Testing Checklist

```bash
# Test 1: Generate audio for each reciter
python -c "
from TTS.api import TTS
tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2', gpu=True)
for reciter in ['abdul_basit', 'alafasy', 'husary']:
    tts.tts_to_file(
        text='السلام عليكم',
        speaker_wav=f'voice_samples/{reciter}_reference.wav',
        language='ar',
        file_path=f'test_{reciter}.wav'
    )
    print(f'✅ {reciter} done')
"

# Test 2: API endpoint
curl http://localhost:8000/generate?text=السلام%20عليكم&reciter=abdul_basit --output test_api.wav

# Test 3: Frontend
# 1. Open http://localhost:3000
# 2. Try each reciter
# 3. Verify audio plays
# 4. Test download
```

### Quality Improvements

If audio quality isn't satisfactory:

```python
# Option 1: Use F5-TTS instead (higher quality)
from f5_tts import F5TTS

model = F5TTS.from_pretrained("SWivid/F5-TTS_v1")
audio = model.synthesize(
    text="بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    reference_audio="voice_samples/abdul_basit_reference.wav",
    language="ar"
)

# Option 2: Get longer reference samples (30-60s)
# Use more verses from EveryAyah dataset

# Option 3: Fine-tune XTTS on Quranic data
# See main roadmap document for training code
```

---

## Docker Deployment (Optional)

```dockerfile
# Dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "backend/main.py"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./voice_samples:/app/voice_samples
    environment:
      - CUDA_VISIBLE_DEVICES=0
  
  frontend:
    image: node:20
    working_dir: /app
    command: npm run dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
```

---

## Troubleshooting

### Issue: "CUDA out of memory"
```python
# Solution: Use CPU or reduce batch size
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
```

### Issue: "Arabic text not generating correctly"
```python
# Verify Arabic encoding
text = "بِسْمِ اللَّهِ".encode('utf-8').decode('utf-8')
print(text)  # Should display properly
```

### Issue: "Audio sounds robotic"
```python
# Get better reference samples (longer, cleaner)
# Use elite reciters with studio quality recordings
```

---

## Next Steps After Demo

Once you have the basic demo working:

1. **Add More Reciters** (10-20 total)
   - Download more from EveryAyah
   - Create reference samples for each

2. **Add All Verses**
   - Integrate full Quran text database
   - Allow users to select any surah:ayah

3. **Improve UI**
   - Add Arabic keyboard input
   - Show tajweed coloring
   - Add reciter bios/photos

4. **Add ASR for Feedback**
   ```python
   import whisper
   
   model = whisper.load_model("large-v3")
   result = model.transcribe("user_recording.mp3", language="ar")
   print(result["text"])
   ```

5. **Deploy to Cloud**
   - Modal.com for GPU backend
   - Vercel for frontend
   - Cloudflare R2 for voice samples

---

## Success Metrics

After 48 hours, you should have:
- ✅ 5 working reciter voices
- ✅ 4+ common verses generating correctly
- ✅ Clean web interface
- ✅ Sub-5s generation time
- ✅ Acceptable audio quality (70%+ similarity to original)

**If you've achieved this, you're ready to proceed to Phase 2 (Teaching Engine) from the main roadmap!**

---

## Resources for Next Phase

- **Main Roadmap:** quranic_recitation_ai_research_roadmap.md
- **F5-TTS Docs:** https://github.com/SWivid/F5-TTS
- **XTTS Docs:** https://docs.coqui.ai/
- **EveryAyah Dataset:** https://huggingface.co/datasets/tarteel-ai/everyayah

---

**Remember:** Start simple, iterate fast, and get user feedback early. The goal of this 48-hour sprint is a working demo you can show to potential users to validate the concept.

**May your coding be bug-free and your commits plentiful!** 🚀

---

*Quick-Start Guide v1.0*  
*Last Updated: November 1, 2025*
