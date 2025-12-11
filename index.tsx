import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Camera, Upload, X, Check, RefreshCw, ChefHat, Info, Zap, Activity, ArrowLeft } from "lucide-react";

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

interface MealRecord {
  id: string;
  timestamp: number;
  image: string;
  result: AnalysisResult;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// --- Gemini Configuration ---
const analyzeImageWithRetry = async (base64Image: string, maxRetries = 3): Promise<AnalysisResult> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await analyzeImage(base64Image);
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Retry on 503 (service unavailable) or 429 (rate limit)
      if ((error.status === 503 || error.status === 429) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry on other errors
      throw error;
    }
  }
  
  throw new Error("Failed after multiple retries");
};

const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  // Debug: Check if API key is available
  if (!process.env.API_KEY) {
    console.error("❌ API Key is missing!");
    throw new Error("API Key not configured. Please check your .env.local file.");
  }
  
  console.log("🔑 API Key found, starting analysis...");
  console.log("📷 Image data length:", base64Image.length);

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

  try {
    console.log("🤖 Calling Gemini API...");
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

    console.log("✅ Got response from Gemini");
    const text = response.text;
    console.log("📄 Response text:", text);
    
    if (!text) {
      console.error("❌ Empty response from AI");
      throw new Error("No response from AI");
    }
    
    const result = JSON.parse(text) as AnalysisResult;
    console.log("🎉 Successfully parsed result:", result);
    return result;
    
  } catch (error: any) {
    console.error("❌ Gemini API Error:", error);
    console.error("Error details:", error.message);
    console.error("Error status:", error.status);
    console.error("Error code:", error.code);
    
    // Provide more specific error messages
    if (error.message.includes("API_KEY")) {
      throw new Error("API Key 无效或未配置。请检查 .env.local 文件中的 GEMINI_API_KEY。");
    } else if (error.message.includes("quota") || error.status === 429) {
      throw new Error("API 配额已用完。请稍后再试或检查您的 Gemini API 配额。");
    } else if (error.status === 403) {
      throw new Error("API 访问被拒绝。请检查 API Key 权限设置。");
    } else if (error.status === 400) {
      throw new Error("请求格式错误。图片可能损坏或格式不支持。");
    } else if (error.name === "NetworkError" || error.message.includes("fetch")) {
      throw new Error("网络连接失败。请检查网络连接并重试。");
    } else {
      throw new Error(`分析失败: ${error.message || "未知错误"}`);
    }
  }
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
  const [cameraStarted, setCameraStarted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

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

  // iOS PWA camera permission request - must be triggered by user gesture
  const startCamera = async () => {
    try {
      setPermissionError(null);
      
      // iOS specific camera constraints
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      setCameraStarted(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      let errorMessage = "无法访问相机。";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "相机权限被拒绝。请在设置中允许相机访问权限。";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "未找到相机设备。";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "相机被其他应用占用。";
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = "相机不支持所需配置。";
      }
      
      setPermissionError(errorMessage);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

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

  if (!cameraStarted) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-6">
          <h2 className="text-white text-xl font-bold">相机</h2>
          <button 
            onClick={onClose} 
            className="text-white bg-black/50 p-2 rounded-full backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mb-6">
            <Camera size={40} className="text-white" />
          </div>
          
          <h3 className="text-white text-2xl font-bold mb-4">启用相机</h3>
          <p className="text-gray-300 text-center mb-8">
            点击下方按钮请求相机权限，然后拍摄食物照片进行营养分析
          </p>
          
          {permissionError && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6 max-w-sm">
              <p className="text-sm">{permissionError}</p>
            </div>
          )}
          
          <button 
            onClick={startCamera}
            className="w-full max-w-sm py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Camera size={20} />
            启用相机
          </button>

          <label htmlFor="camera-file-upload" className="w-full max-w-sm py-4 bg-gray-700 text-white rounded-xl font-bold text-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={20} />
            上传图片
          </label>
          <input 
            id="camera-file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>
    );
  }

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

// --- Image Compression ---
const compressImage = (base64: string, maxWidth = 800, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      
      // Calculate new dimensions - larger for API analysis
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      // Return only the base64 part for API
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => {
      console.error("❌ Failed to load image for compression");
      resolve(base64); // Return original if compression fails
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

// --- Local Storage Functions ---
const getStorageSize = (): string => {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return `${(total / 1024 / 1024).toFixed(2)}MB`;
};

const saveMealRecord = async (image: string, result: AnalysisResult, mealType: MealRecord['mealType'] = 'snack') => {
  try {
    // Compress image for storage (smaller size)
    const storageImage = await compressImage(image, 200, 0.7);
    // Compress image for API analysis (larger size)
    const apiImage = await compressImage(image, 800, 0.8);
    
    const record: MealRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      image: storageImage, // Store small compressed image
      result,
      mealType
    };
    
    const existingRecords = JSON.parse(localStorage.getItem('mealHistory') || '[]');
    
    // Keep only last 20 records to save space
    const updatedRecords = [record, ...existingRecords].slice(0, 20);
    
    // Check storage quota before saving
    const testData = JSON.stringify(updatedRecords);
    if (testData.length > 4 * 1024 * 1024) { // 4MB limit
      // If still too large, keep only last 10
      const minimalRecords = updatedRecords.slice(0, 10);
      localStorage.setItem('mealHistory', JSON.stringify(minimalRecords));
      console.warn('存储空间接近上限，仅保留最近10条记录');
    } else {
      localStorage.setItem('mealHistory', JSON.stringify(updatedRecords));
    }
    
    console.log('存储使用量:', getStorageSize());
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      // Clear old records and try again
      const existingRecords = JSON.parse(localStorage.getItem('mealHistory') || '[]');
      const recentRecords = existingRecords.slice(0, 5);
      localStorage.setItem('mealHistory', JSON.stringify(recentRecords));
      console.error('存储空间已满，已清理旧记录');
    } else {
      console.error('保存记录失败:', error);
    }
  }
};

const getMealHistory = (): MealRecord[] => {
  try {
    return JSON.parse(localStorage.getItem('mealHistory') || '[]');
  } catch (error) {
    console.error('读取历史记录失败:', error);
    return [];
  }
};

const HistoryPage = ({ history, onClose }: { history: MealRecord[], onClose: () => void }) => {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalCalories = () => {
    return history.reduce((sum, record) => sum + record.result.calories, 0);
  };

  if (history.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">饮食历史</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <History size={32} />
          </div>
          <p className="text-gray-500 mb-2">暂无历史记录</p>
          <p className="text-sm text-gray-400">开始拍照分析你的食物吧！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">饮食历史</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">总卡路里</p>
          <p className="text-2xl font-bold text-green-600">{getTotalCalories()}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {history.map((record) => (
          <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex gap-4 p-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <img 
                  src={`data:image/jpeg;base64,${record.image}`} 
                  alt={record.result.foodName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 truncate">{record.result.foodName}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    record.result.rating >= 8 ? 'bg-green-100 text-green-700' :
                    record.result.rating >= 5 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {record.result.rating}/10
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{formatDate(record.timestamp)}</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold text-gray-900">{record.result.calories}</span>
                    <span className="text-gray-500">卡路里</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-600">
                    <span>蛋白质 {record.result.macros.protein}g</span>
                    <span>碳水 {record.result.macros.carbs}g</span>
                    <span>脂肪 {record.result.macros.fat}g</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const App = () => {
  const [image, setImage] = useState<string | null>(null); // base64
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<MealRecord[]>([]);

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
      // Compress image for API analysis before sending
      const apiImage = await compressImage(image, 800, 0.8);
      console.log("📸 Original image size:", image.length);
      console.log("🗜️ Compressed image size:", apiImage.length);
      
      const data = await analyzeImageWithRetry(apiImage);
      setResult(data);
      // Auto save to history
      await saveMealRecord(image, data);
      setHistory(getMealHistory());
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

  useEffect(() => {
    setHistory(getMealHistory());
  }, []);

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
