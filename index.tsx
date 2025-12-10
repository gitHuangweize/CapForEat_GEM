import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Camera, Upload, X, Check, RefreshCw, ChefHat, Info, Zap, Activity } from "lucide-react";

// --- Types ---
interface MacroNutrients {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface AnalysisResult {
  foodName: string;
  calories: number;
  servingSize: string;
  macros: MacroNutrients;
  healthAnalysis: string;
  rating: number; // 1-10
}

// --- Gemini Configuration ---
const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
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
  return JSON.parse(text) as AnalysisResult;
};

// --- Components ---

const NutritionLabel = ({ data }: { data: AnalysisResult }) => {
  const { foodName, calories, servingSize, macros, healthAnalysis, rating } = data;

  const getRatingColor = (r: number) => {
    if (r >= 8) return "bg-green-500";
    if (r >= 5) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 relative">
        <div className={`absolute top-4 right-4 ${getRatingColor(rating)} text-white font-bold rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-lg`}>
          {rating}
        </div>
        <h2 className="text-2xl font-bold font-serif pr-12">{foodName}</h2>
        <p className="text-slate-300 text-sm mt-1">{servingSize}</p>
      </div>

      <div className="p-6">
        {/* Calories */}
        <div className="flex justify-between items-baseline border-b-4 border-black pb-2 mb-4">
          <span className="text-xl font-bold text-gray-800">Calories</span>
          <span className="text-5xl font-black text-gray-900">{calories}</span>
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-xl">
            <span className="block text-blue-800 font-bold text-lg">{macros.protein}g</span>
            <span className="text-xs text-blue-600 uppercase tracking-wide">Protein</span>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-xl">
            <span className="block text-orange-800 font-bold text-lg">{macros.carbs}g</span>
            <span className="text-xs text-orange-600 uppercase tracking-wide">Carbs</span>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-xl">
            <span className="block text-yellow-800 font-bold text-lg">{macros.fat}g</span>
            <span className="text-xs text-yellow-600 uppercase tracking-wide">Fat</span>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-2 text-sm text-gray-700 mb-6 font-mono">
          <div className="flex justify-between border-b border-gray-200 py-1">
            <span>Fiber</span>
            <span className="font-bold">{macros.fiber}g</span>
          </div>
           {/* Add dummy values for visuals if needed or derived data */}
           <div className="flex justify-between border-b border-gray-200 py-1">
            <span>Energy Density</span>
            <span className="font-bold">{calories > 500 ? 'High' : 'Moderate'}</span>
          </div>
        </div>

        {/* Analysis */}
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="flex items-center gap-2 mb-2 text-green-800 font-bold">
            <ChefHat size={18} />
            <span>Dietitian's Note</span>
          </div>
          <p className="text-green-900 text-sm leading-relaxed">
            {healthAnalysis}
          </p>
        </div>
      </div>
    </div>
  );
};

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        
        // Stop stream
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

const App = () => {
  const [image, setImage] = useState<string | null>(null); // base64
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        setImage(base64);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (base64: string) => {
    setImage(base64);
    setCameraOpen(false);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeImage(image);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to analyze image. Please try again. " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-green-200">
      {cameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />}
      
      <main className="max-w-md mx-auto min-h-screen flex flex-col p-6">
        
        {/* Header */}
        <header className="mb-8 mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
              <span className="text-green-600">Cap</span>ForEat
            </h1>
            <p className="text-gray-500 text-sm mt-1">Smart Nutrition Scanner</p>
          </div>
          {image && (
            <button onClick={reset} className="text-sm font-medium text-gray-500 hover:text-red-500 transition-colors">
              Reset
            </button>
          )}
        </header>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg animate-fadeIn">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {!image ? (
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 text-center">
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
                    className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-200/50"
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
                    <button className="w-full py-4 bg-white border-2 border-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:border-gray-200 transition-colors flex items-center justify-center gap-2">
                      <Upload size={20} />
                      Upload Image
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-orange-50 p-4 rounded-2xl">
                    <Zap className="text-orange-500 mb-2" size={24} />
                    <p className="font-bold text-sm text-orange-900">Instant Calories</p>
                 </div>
                 <div className="bg-blue-50 p-4 rounded-2xl">
                    <Activity className="text-blue-500 mb-2" size={24} />
                    <p className="font-bold text-sm text-blue-900">Macro Details</p>
                 </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Image Preview & Analyze Button */}
              {!result && (
                <div className="space-y-6">
                  <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-square group">
                    <img 
                      src={`data:image/jpeg;base64,${image}`} 
                      alt="Meal" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl transition-all ${
                      loading 
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                        : "bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]"
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
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-6 pb-12">
                   <div className="relative h-48 rounded-3xl overflow-hidden shadow-md">
                    <img 
                        src={`data:image/jpeg;base64,${image}`} 
                        alt="Meal" 
                        className="w-full h-full object-cover opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4 text-white">
                        <p className="text-sm font-medium opacity-80">Analyzed Image</p>
                      </div>
                  </div>
                  
                  <NutritionLabel data={result} />
                  
                  <button 
                    onClick={reset}
                    className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Scan Another Meal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
