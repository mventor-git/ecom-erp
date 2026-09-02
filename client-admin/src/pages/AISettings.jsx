import { useState, useEffect } from 'react';
import { getModels, selectModel, getAISettings, updateAISettings } from '../api/adminApi';

export default function AISettings() {
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState('');
  const [settings, setSettings] = useState({
    personality: '',
    temperature: 0.3,
    maxTokens: 150,
    timeout: 15000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsRes, settingsRes] = await Promise.all([
        getModels(),
        getAISettings(),
      ]);

      if (modelsRes.success) {
        setModels(modelsRes.data.models);
        setCurrentModel(modelsRes.data.currentModel);
      }

      if (settingsRes.success) {
        setSettings({
          personality: settingsRes.data.personality,
          temperature: settingsRes.data.temperature,
          maxTokens: settingsRes.data.maxTokens,
          timeout: settingsRes.data.timeout,
        });
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
      showMessage('error', 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (model) => {
    try {
      const res = await selectModel(model);
      if (res.success) {
        setCurrentModel(model);
        showMessage('success', `Model changed to ${model}`);
      } else {
        showMessage('error', res.error || 'Failed to change model');
      }
    } catch (error) {
      console.error('Error changing model:', error);
      showMessage('error', 'Failed to change model');
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await updateAISettings(settings);
      if (res.success) {
        showMessage('success', 'AI settings updated successfully');
      } else {
        showMessage('error', res.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showMessage('error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Assistant Settings</h1>
        <p className="text-gray-600 mt-2">Configure your AI assistant's model, personality, and behavior</p>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Model Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Model Selection</h2>
        <p className="text-sm text-gray-600 mb-4">
          Choose which Ollama model to use for the AI assistant. Models are loaded from your local Ollama instance.
        </p>
        
        <div className="space-y-3">
          {models.map((model) => (
            <div
              key={model.name}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                currentModel === model.name
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleModelChange(model.name)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{model.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Size: {(model.size / 1024 / 1024 / 1024).toFixed(2)} GB
                  </p>
                  {model.details && (
                    <p className="text-xs text-gray-500 mt-1">
                      {model.details}
                    </p>
                  )}
                </div>
                {currentModel === model.name && (
                  <div className="flex items-center gap-2 text-primary-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Active</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {models.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No models found. Make sure Ollama is running and has models installed.</p>
            <p className="text-sm mt-2">Run <code className="bg-gray-100 px-2 py-1 rounded">ollama list</code> to see available models.</p>
          </div>
        )}
      </div>

      {/* AI Personality */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Personality & Soul</h2>
        <p className="text-sm text-gray-600 mb-4">
          Define the AI's personality, values, and communication style. This shapes how the AI interacts with customers.
        </p>
        
        <textarea
          value={settings.personality}
          onChange={(e) => setSettings({ ...settings, personality: e.target.value })}
          className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
          placeholder="Enter the AI's personality and constitution..."
        />
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Tips for a great AI personality:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Define the AI's role and purpose</li>
            <li>• Set the tone (friendly, professional, casual)</li>
            <li>• Include brand values and mission</li>
            <li>• Specify communication guidelines</li>
            <li>• Add product expertise areas</li>
            <li>• Include cultural context (Egypt, Arabic/English)</li>
          </ul>
        </div>
      </div>

      {/* Performance Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Settings</h2>
        <p className="text-sm text-gray-600 mb-4">
          Fine-tune the AI's response behavior for optimal performance on your hardware.
        </p>
        
        <div className="space-y-6">
          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature: {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Focused (0)</span>
              <span>Creative (1)</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Lower values make responses more focused and deterministic. Higher values make them more creative and varied.
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Response Length: {settings.maxTokens} tokens
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={settings.maxTokens}
              onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Short (50)</span>
              <span>Long (500)</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Maximum number of tokens (words/characters) in AI responses. Lower values = faster responses.
            </p>
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Timeout: {settings.timeout / 1000} seconds
            </label>
            <input
              type="range"
              min="5000"
              max="30000"
              step="1000"
              value={settings.timeout}
              onChange={(e) => setSettings({ ...settings, timeout: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Fast (5s)</span>
              <span>Slow (30s)</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Maximum time to wait for AI response before showing timeout error.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
