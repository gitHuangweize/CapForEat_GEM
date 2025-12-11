import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Camera, Upload, X, Check, RefreshCw, ChefHat, Home, Clock, Settings, Plus, TrendingUp, Target } from "lucide-react";

// --- Types ---
interface MacroNutrients {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface AnalysisResult {
  id: string;
  timestamp: number;
  foodName: string;
  calories: number;
  servingSize: string;
  macros: MacroNutrients;
  healthAnalysis: string;
  rating: number;
  image: string;
}

interface DailyStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}

// --- Gemini Configuration ---
const analyzeImage = async (base64Image: string): Promise<Omit<AnalysisResult, 'id' | 'timestamp' | 'image'>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      foodName: { type: Type.STRING, description: "Name of the identified food or dish" },
      calories: { type: Type.INTEGER, description: "Estimated total calories" },
      servingSize: { type: Type.STRING, description: "Estimated serving size (e.g. 1 bowl, 200g)" },
      macros: {
        type: Type.OBJECT,
        properties: {
          protein: { type: Type.INTEGER, description: "Protein in grams" },
          carbs: { type: Type.INTEGER, description: "Carbohydrates in grams" },
          fat: { type: Type.INTEGER, description: "Total fat in grams" },
          fiber: { type: Type.INTEGER, description: "Fiber in grams" },
        },
        required: ["protein", "carbs", "fat", "fiber"],
      },
      healthAnalysis: { type: Type.STRING, description: "Brief analysis of nutritional value and healthiness" },
      rating: { type: Type.INTEGER, description: "Health score from 1 (unhealthy) to 10 (very healthy)" },
    },
    required: ["foodName", "calories", "servingSize", "macros", "healthAnalysis", "rating"],
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: "Analyze this food image. Estimate nutritional content for the entire portion shown. Be realistic but approximate.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: "You are an expert nutritionist and dietitian. Analyze food images to provide nutritional estimates.",
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
};

// --- Local Storage ---
const STORAGE_KEY = 'capforeat_data';

const loadData = (): AnalysisResult[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveData = (records: AnalysisResult[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
};

const getTodayStats = (records: AnalysisResult[]): DailyStats => {
  const today = new Date().toDateString();
  const todayRecords = records.filter(r => new Date(r.timestamp).toDateString() === today);
  
  return {
    totalCalories: todayRecords.reduce((sum, r) => sum + r.calories, 0),
    totalProtein: todayRecords.reduce((sum, r) => sum + r.macros.protein, 0),
    totalCarbs: todayRecords.reduce((sum, r) => sum + r.macros.carbs, 0),
    totalFat: todayRecords.reduce((sum, r) => sum + r.macros.fat, 0),
    mealCount: todayRecords.length,
  };
};

// --- Components ---
const CameraCapture = ({ onCapture, onClose }: { onCapture: (img: string) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Could not access camera. Please allow permissions or use file upload.");
        onClose();
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64 = dataUrl.split(",")[1];
        
        if (stream) stream.getTracks().forEach(t => t.stop());
        onCapture(base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="relative flex-1 bg-black">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-white bg-black/50 p-2 rounded-full backdrop-blur-md"
        >
          <X size={24} />
        </button>
      </div>
      <div className="h-32 bg-black flex items-center justify-center pb-8">
        <button 
          onClick={handleCapture}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 bg-white rounded-full" />
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const NutritionCard = ({ data, onView }: { data: AnalysisResult, onView: (data: AnalysisResult) => void }) => {
  const getRatingColor = (r: number) => {
    if (r >= 8) return "text-green-600 bg-green-50";
    if (r >= 5) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div 
      onClick={() => onView(data)}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex gap-4">
        <img 
          src={`data:image/jpeg;base64,${data.image}`} 
          alt={data.foodName}
          className="w-20 h-20 rounded-xl object-cover"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-gray-900">{data.foodName}</h3>
              <p className="text-sm text-gray-500">{data.servingSize}</p>
            </div>
            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getRatingColor(data.rating)}`}>
              {data.rating}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-2xl font-bold text-gray-900">{data.calories}</div>
            <div className="text-xs text-gray-500">
              <span className="font-medium">{data.macros.protein}g</span> P • 
              <span className="font-medium">{data.macros.carbs}g</span> C • 
              <span className="font-medium">{data.macros.fat}g</span> F
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HomePage = ({ records, onAnalyzeNew }: { records: AnalysisResult[], onAnalyzeNew: () => void }) => {
  const stats = getTodayStats(records);
  const todayRecords = records.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString());

  return (
    <div className="flex-1 pb-20">
      {/* Today's Summary */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 text-white mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Today's Intake</h2>
          <Target size={24} />
        </div>
        <div className="text-4xl font-bold mb-2">{stats.totalCalories}</div>
        <div className="text-green-100 text-sm mb-4">calories • {stats.mealCount} meals</div>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{stats.totalProtein}g</div>
            <div className="text-xs text-green-100">Protein</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{stats.totalCarbs}g</div>
            <div className="text-xs text-green-100">Carbs</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{stats.totalFat}g</div>
            <div className="text-xs text-green-100">Fat</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <button 
        onClick={onAnalyzeNew}
        className="w-full bg-black text-white rounded-2xl p-4 font-bold text-lg flex items-center justify-center gap-3 mb-6 hover:bg-gray-800 transition-colors"
      >
        <Plus size={24} />
        Scan New Meal
      </button>

      {/* Today's Meals */}
      <div>
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Clock size={18} />
          Today's Meals
        </h3>
        {todayRecords.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <Camera size={20} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No meals recorded today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayRecords.slice().reverse().map(record => (
              <NutritionCard key={record.id} data={record} onView={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryPage = ({ records }: { records: AnalysisResult[] }) => {
  const groupedRecords = records.reduce((acc, record) => {
    const date = new Date(record.timestamp).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AnalysisResult[]>);

  return (
    <div className="flex-1 pb-20">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Clock size={24} />
        History
      </h2>
      
      {Object.keys(groupedRecords).length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock size={20} className="text-gray-400" />
          </div>
          <p className="text-gray-500">No meal history yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRecords)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, dayRecords]) => (
              <div key={date}>
                <h3 className="font-bold text-gray-700 mb-3">
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <div className="space-y-3">
                  {dayRecords.map(record => (
                    <NutritionCard key={record.id} data={record} onView={() => {}} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const SettingsPage = () => {
  return (
    <div className="flex-1 pb-20">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Settings size={24} />
        Settings
      </h2>
      
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2">Daily Goals</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Calories</span>
              <span className="font-bold">2000 kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Protein</span>
              <span className="font-bold">50g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Carbs</span>
              <span className="font-bold">250g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Fat</span>
              <span className="font-bold">65g</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-2">About</h3>
          <p className="text-gray-600 text-sm mb-2">CapForEat - Smart Nutrition Scanner</p>
          <p className="text-gray-500 text-xs">Version 1.0.0</p>
        </div>

        <button className="w-full bg-red-50 text-red-600 rounded-2xl p-4 font-bold hover:bg-red-100 transition-colors">
          Clear All Data
        </button>
      </div>
    </div>
  );
};

const AnalysisPage = ({ image, onBack, onSave }: { 
  image: string, 
  onBack: () => void, 
  onSave: (result: Omit<AnalysisResult, 'id' | 'timestamp' | 'image'>) => void 
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Omit<AnalysisResult, 'id' | 'timestamp' | 'image'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeImage(image);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to analyze image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (result) {
      onSave(result);
    }
  };

  return (
    <div className="flex-1 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-gray-600">
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Analyze Meal</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-square">
          <img 
            src={`data:image/jpeg;base64,${image}`} 
            alt="Meal" 
            className="w-full h-full object-cover"
          />
        </div>

        {!result ? (
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              loading 
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Check />
                Analyze Nutrition
              </>
            )}
          </button>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{result.foodName}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  result.rating >= 8 ? "bg-green-100 text-green-700" :
                  result.rating >= 5 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {result.rating}/10
                </span>
              </div>

              <div className="text-3xl font-black text-gray-900 mb-4">{result.calories} kcal</div>
              <p className="text-gray-500 text-sm mb-4">{result.servingSize}</p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <span className="block text-blue-800 font-bold text-lg">{result.macros.protein}g</span>
                  <span className="text-xs text-blue-600">Protein</span>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-xl">
                  <span className="block text-orange-800 font-bold text-lg">{result.macros.carbs}g</span>
                  <span className="text-xs text-orange-600">Carbs</span>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-xl">
                  <span className="block text-yellow-800 font-bold text-lg">{result.macros.fat}g</span>
                  <span className="text-xs text-yellow-600">Fat</span>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-green-800 font-bold">
                  <ChefHat size={16} />
                  <span className="text-sm">Dietitian's Note</span>
                </div>
                <p className="text-green-900 text-sm">{result.healthAnalysis}</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-black text-white rounded-xl p-4 font-bold hover:bg-gray-800 transition-colors"
            >
              Save to Today's Log
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CapturePage = ({ onCapture, onClose }: { onCapture: (img: string) => void, onClose: () => void }) => {
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        onCapture(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex-1 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="text-gray-600">
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Add Meal</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-50 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
            <Camera size={40} />
          </div>
          <h3 className="text-xl font-bold mb-2">Snap your meal</h3>
          <p className="text-gray-500 mb-8">
            Take a photo or upload an image to instantly get calorie and macro breakdown.
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={() => setCameraOpen(true)}
              className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <Camera size={20} />
              Take Photo
            </button>
            <div className="relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-lg hover:border-gray-300 transition-colors flex items-center justify-center gap-2">
                <Upload size={20} />
                Upload Image
              </button>
            </div>
          </div>
        </div>
      </div>

      {cameraOpen && <CameraCapture onCapture={onCapture} onClose={() => setCameraOpen(false)} />}
    </div>
  );
};

// --- Main App ---
const App = () => {
  const [currentPage, setCurrentPage] = useState<'home' | 'history' | 'settings'>('home');
  const [captureMode, setCaptureMode] = useState(false);
  const [analysisImage, setAnalysisImage] = useState<string | null>(null);
  const [records, setRecords] = useState<AnalysisResult[]>([]);

  useEffect(() => {
    setRecords(loadData());
  }, []);

  const handleSaveRecord = (result: Omit<AnalysisResult, 'id' | 'timestamp' | 'image'>) => {
    if (!analysisImage) return;
    
    const newRecord: AnalysisResult = {
      ...result,
      id: Date.now().toString(),
      timestamp: Date.now(),
      image: analysisImage,
    };
    
    const updatedRecords = [...records, newRecord];
    setRecords(updatedRecords);
    saveData(updatedRecords);
    
    setAnalysisImage(null);
    setCurrentPage('home');
  };

  const renderContent = () => {
    if (analysisImage) {
      return (
        <AnalysisPage 
          image={analysisImage}
          onBack={() => setAnalysisImage(null)}
          onSave={handleSaveRecord}
        />
      );
    }

    if (captureMode) {
      return (
        <CapturePage 
          onCapture={setAnalysisImage}
          onClose={() => setCaptureMode(false)}
        />
      );
    }

    switch (currentPage) {
      case 'home':
        return <HomePage records={records} onAnalyzeNew={() => setCaptureMode(true)} />;
      case 'history':
        return <HistoryPage records={records} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage records={records} onAnalyzeNew={() => setCaptureMode(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <span className="text-green-600">Cap</span>ForEat
          </h1>
        </header>

        {/* Main Content */}
        {renderContent()}

        {/* Bottom Navigation */}
        {!captureMode && !analysisImage && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
            <div className="max-w-md mx-auto flex items-center justify-around py-2">
              <button
                onClick={() => setCurrentPage('home')}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                  currentPage === 'home' ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <Home size={20} />
                <span className="text-xs font-medium">Home</span>
              </button>
              <button
                onClick={() => setCurrentPage('history')}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                  currentPage === 'history' ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <Clock size={20} />
                <span className="text-xs font-medium">History</span>
              </button>
              <button
                onClick={() => setCurrentPage('settings')}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                  currentPage === 'settings' ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <Settings size={20} />
                <span className="text-xs font-medium">Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
