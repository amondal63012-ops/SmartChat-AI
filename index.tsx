import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

// Assume 'marked' is available globally from the script tag in index.html
declare var marked: any;

interface MessagePart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface Message {
    role: 'user' | 'model';
    parts: MessagePart[];
}

const App = () => {
    const [prompt, setPrompt] = useState('');
    const [chatHistory, setChatHistory] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [theme, setTheme] = useState('light');
    const [image, setImage] = useState<{ data: string; mimeType: string } | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [chatHistory]);
    
    useEffect(() => {
        document.body.style.backgroundColor = theme === 'light' ? '#f0f4f8' : '#1a202c';
    }, [theme]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setImage({ data: base64String, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() && !image) {
            setError('Please enter a prompt or upload an image.');
            return;
        }
        setIsLoading(true);
        setError('');

        const userParts: MessagePart[] = [];
        if (image) {
            userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
        }
        if (prompt) {
            userParts.push({ text: prompt });
        }

        const newUserMessage: Message = { role: 'user', parts: userParts };
        const newModelMessage: Message = { role: 'model', parts: [{ text: '' }] };

        setChatHistory(prev => [...prev, newUserMessage, newModelMessage]);
        setPrompt('');
        setImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: { parts: userParts },
            });

            let text = '';
            for await (const chunk of stream) {
                text += chunk.text;
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1].parts = [{ text }];
                    return newHistory;
                });
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(`Error: ${errorMessage}. Please check your API key and network connection.`);
             setChatHistory(prev => prev.slice(0, -2));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            handleGenerate();
        }
    };
    
    const currentStyles = styles(theme);

    return (
        <div style={currentStyles.appContainer}>
            <header style={currentStyles.header}>
                <h1 style={currentStyles.title}>⚡️ Fast Chat AI</h1>
                <div style={currentStyles.themeToggle} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                   <div style={currentStyles.themeToggleIcon}> {theme === 'light' ? '🌙' : '☀️'}</div>
                </div>
            </header>
            <main style={currentStyles.contentArea} ref={contentRef}>
                {error && <p style={currentStyles.error}>{error}</p>}
                {chatHistory.length === 0 && !isLoading && !error && (
                    <div style={currentStyles.placeholder}>
                        <h2>Ask me anything...</h2>
                        <p>e.g., "Explain quantum computing in simple terms"</p>
                    </div>
                )}
                {chatHistory.map((message, index) => (
                    <div key={index} style={message.role === 'user' ? currentStyles.userMessage : currentStyles.modelMessage}>
                        {message.parts.map((part, partIndex) => {
                            if (part.text || part.text === '') {
                                const isLoadingMessage = isLoading && index === chatHistory.length - 1;
                                return (
                                    <div key={partIndex}
                                         dangerouslySetInnerHTML={{__html: marked.parse(part.text + (isLoadingMessage ? '▌' : ''))}}
                                    ></div>
                                );
                            }
                            if (part.inlineData) {
                                return <img key={partIndex} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} alt="User upload" style={currentStyles.uploadedImage}/>
                            }
                            return null;
                        })}
                    </div>
                ))}
            </main>
            <div style={currentStyles.inputArea}>
                {image && (
                    <div style={currentStyles.imagePreviewContainer}>
                        <img src={`data:${image.mimeType};base64,${image.data}`} alt="Preview" style={currentStyles.imagePreview} />
                        <button onClick={() => {setImage(null); if (fileInputRef.current) fileInputRef.current.value = '';}} style={currentStyles.removeImageButton}>&times;</button>
                    </div>
                )}
                <div style={currentStyles.inputContainer}>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} />
                    <button onClick={() => fileInputRef.current?.click()} style={currentStyles.iconButton} aria-label="Attach image">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05l-9.19 9.19a6.003 6.003 0 11-8.49-8.49l9.19-9.19a4.002 4.002 0 015.66 5.66l-9.2 9.19a2.001 2.001 0 11-2.83-2.83l8.49-8.48" stroke={currentStyles.iconButton.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Enter your prompt here..."
                        style={currentStyles.input}
                        disabled={isLoading}
                        aria-label="Prompt input"
                        rows={1}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || (!prompt.trim() && !image)}
                        style={isLoading || (!prompt.trim() && !image) ? {...currentStyles.button, ...currentStyles.buttonDisabled} : currentStyles.button}
                        aria-label="Generate response"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={currentStyles.sendIcon}>
                            <path d="M3.4 20.4L20.85 12.02L3.4 3.6V10.1L15.1 12.02L3.4 13.9V20.4Z" fill="white"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const themes = {
    light: {
        bg: '#f0f4f8',
        headerBg: '#ffffff',
        text: '#1a202c',
        placeholderText: '#718096',
        inputBg: '#ffffff',
        inputBorder: '#dcdcdc',
        userMessageBg: '#007bff',
        userMessageText: '#ffffff',
        modelMessageBg: '#ffffff',
        modelMessageText: '#2d3748',
        buttonBg: '#007bff',
        buttonDisabledBg: '#aaa',
        borderColor: '#e0e0e0',
        shadow: '0 2px 4px rgba(0,0,0,0.05)',
        iconColor: '#555'
    },
    dark: {
        bg: '#1a202c',
        headerBg: '#2d3748',
        text: '#e2e8f0',
        placeholderText: '#a0aec0',
        inputBg: '#2d3748',
        inputBorder: '#4a5568',
        userMessageBg: '#4299e1',
        userMessageText: '#ffffff',
        modelMessageBg: '#2d3748',
        modelMessageText: '#e2e8f0',
        buttonBg: '#4299e1',
        buttonDisabledBg: '#555',
        borderColor: '#4a5568',
        shadow: '0 2px 4px rgba(0,0,0,0.2)',
        iconColor: '#ccc'
    }
};

const styles = (theme: 'light' | 'dark'): { [key: string]: React.CSSProperties } => {
    const currentTheme = themes[theme];
    return {
        appContainer: {
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            backgroundColor: currentTheme.bg,
            color: currentTheme.text,
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: currentTheme.headerBg,
            padding: '1rem',
            boxShadow: currentTheme.shadow,
            borderBottom: `1px solid ${currentTheme.borderColor}`,
            zIndex: 10,
        },
        title: { fontSize: '1.5rem', fontWeight: '700', color: currentTheme.text, margin: 0 },
        themeToggle: { cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', backgroundColor: currentTheme.bg },
        themeToggleIcon: { fontSize: '1.2rem' },
        contentArea: {
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            paddingBottom: '120px',
        },
        placeholder: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', color: currentTheme.placeholderText },
        userMessage: { alignSelf: 'flex-end', backgroundColor: currentTheme.userMessageBg, color: currentTheme.userMessageText, padding: '0.75rem 1.25rem', borderRadius: '18px', marginBottom: '0.75rem', maxWidth: '80%', wordWrap: 'break-word', marginLeft: 'auto' },
        modelMessage: { alignSelf: 'flex-start', backgroundColor: currentTheme.modelMessageBg, color: currentTheme.modelMessageText, padding: '0.75rem 1.25rem', borderRadius: '18px', marginBottom: '0.75rem', maxWidth: '80%', wordWrap: 'break-word', marginRight: 'auto', lineHeight: 1.7 },
        uploadedImage: { maxWidth: '100%', borderRadius: '12px', marginTop: '0.5rem' },
        inputArea: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem 1.5rem', backgroundColor: `rgba(${theme === 'light' ? '255, 255, 255, 0.9' : '45, 55, 72, 0.9'})`, backdropFilter: 'blur(10px)', borderTop: `1px solid ${currentTheme.borderColor}` },
        imagePreviewContainer: { position: 'relative', display: 'inline-block', marginBottom: '0.5rem' },
        imagePreview: { height: '50px', borderRadius: '8px', border: `1px solid ${currentTheme.borderColor}` },
        removeImageButton: { position: 'absolute', top: '-5px', right: '-5px', background: '#333', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '20px', padding: 0 },
        inputContainer: { display: 'flex', alignItems: 'center' },
        input: { flex: 1, padding: '0.9rem 1.2rem', fontSize: '1rem', borderRadius: '24px', border: `1px solid ${currentTheme.inputBorder}`, marginRight: '1rem', backgroundColor: currentTheme.inputBg, color: currentTheme.text, resize: 'none', height: '48px', overflowY: 'hidden' },
        button: { width: '48px', height: '48px', backgroundColor: currentTheme.buttonBg, color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        buttonDisabled: { backgroundColor: currentTheme.buttonDisabledBg, cursor: 'not-allowed' },
        iconButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', marginRight: '0.5rem', color: currentTheme.iconColor },
        sendIcon: { display: 'block' },
        error: { color: '#d93025', backgroundColor: '#fbe9e7', padding: '1rem', borderRadius: '8px', textAlign: 'left' },
    };
};

const dynamicStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  textarea:focus {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    outline: none;
  }
  button:hover:not(:disabled) {
    opacity: 0.8;
  }
  div[class*="message"] p:first-child { margin-top: 0; }
  div[class*="message"] p:last-child { margin-bottom: 0; }
  div[class*="message"] h1, div[class*="message"] h2, div[class*="message"] h3 {
    margin-top: 1em;
    margin-bottom: 0.5em;
  }
  div[class*="message"] ul, div[class*="message"] ol {
    padding-left: 1.5rem;
  }
  div[class*="message"] code {
    background-color: rgba(0,0,0,0.1);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-size: 85%;
  }
  div[class*="message"] pre {
    background-color: rgba(0,0,0,0.8);
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
  }
  div[class*="message"] pre code {
    background-color: transparent;
    padding: 0;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = dynamicStyles;
document.head.appendChild(styleSheet);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);