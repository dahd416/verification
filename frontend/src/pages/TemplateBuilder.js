import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer, Group } from 'react-konva';
import useImage from 'use-image';
import { QRCodeSVG } from 'qrcode.react';
import { templatesAPI, uploadAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Save,
  Type,
  ImageIcon,
  Variable,
  Trash2,
  Upload,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Search,
} from 'lucide-react';

// Variable options
const VARIABLES = [
  { value: 'recipient_name', label: 'Recipient Name' },
  { value: 'course_name', label: 'Course Name' },
  { value: 'completion_date', label: 'Completion Date' },
  { value: 'instructor_name', label: 'Instructor Name' },
  { value: 'duration_hours', label: 'Duration Hours' },
  { value: 'certificate_id', label: 'Certificate ID' },
  { value: 'qr_code', label: 'QR Code' },
];

// Google Fonts catalog organized by category
const GOOGLE_FONTS = {
  'Sans Serif': [
    'Urbanist',
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Poppins',
    'Nunito',
    'Raleway',
    'Work Sans',
    'DM Sans',
    'Manrope',
    'Plus Jakarta Sans',
    'Source Sans 3',
    'Mulish',
    'Outfit',
    'Quicksand',
    'Rubik',
    'Karla',
    'Cabin',
    'Barlow',
    'Oswald',
    'Fira Sans',
    'Exo 2',
    'Lexend',
    'Albert Sans',
    'Sora',
    'Space Grotesk',
    'Be Vietnam Pro',
    'Red Hat Display',
  ],
  'Serif': [
    'Playfair Display',
    'Libre Baskerville',
    'Merriweather',
    'Lora',
    'Crimson Text',
    'PT Serif',
    'Source Serif 4',
    'Cormorant Garamond',
    'EB Garamond',
    'Cinzel',
    'Bitter',
    'Domine',
    'Spectral',
    'Alegreya',
    'Frank Ruhl Libre',
    'Vollkorn',
    'Cardo',
    'Noto Serif',
    'IBM Plex Serif',
    'Old Standard TT',
  ],
  'Display': [
    'Bebas Neue',
    'Abril Fatface',
    'Righteous',
    'Alfa Slab One',
    'Fredoka',
    'Pacifico',
    'Lobster',
    'Permanent Marker',
    'Satisfy',
    'Cookie',
    'Courgette',
    'Great Vibes',
    'Sacramento',
    'Tangerine',
    'Kaushan Script',
    'Allura',
    'Alex Brush',
    'Pinyon Script',
    'Marck Script',
    'Rouge Script',
  ],
  'Handwriting': [
    'Dancing Script',
    'Caveat',
    'Pacifico',
    'Kalam',
    'Indie Flower',
    'Shadows Into Light',
    'Amatic SC',
    'Handlee',
    'Patrick Hand',
    'Gloria Hallelujah',
    'Architects Daughter',
    'Coming Soon',
    'Covered By Your Grace',
    'Rock Salt',
    'Reenie Beanie',
    'Just Another Hand',
    'Nothing You Could Do',
    'Cedarville Cursive',
    'La Belle Aurore',
    'Sue Ellen Francisco',
  ],
  'Monospace': [
    'JetBrains Mono',
    'Fira Code',
    'Source Code Pro',
    'IBM Plex Mono',
    'Roboto Mono',
    'Space Mono',
    'Ubuntu Mono',
    'Inconsolata',
    'Anonymous Pro',
    'Cousine',
  ],
};

// Flatten fonts for easy lookup
const ALL_FONTS = Object.values(GOOGLE_FONTS).flat();

// Load Google Font dynamically
const loadGoogleFont = (fontName) => {
  const formattedName = fontName.replace(/ /g, '+');
  const linkId = `google-font-${formattedName}`;
  
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
};

// Load default fonts on mount
const DEFAULT_FONTS = ['Urbanist', 'Playfair Display', 'Libre Baskerville', 'Dancing Script', 'Roboto'];
DEFAULT_FONTS.forEach(loadGoogleFont);

// Background image component
const BackgroundImage = ({ url, width, height }) => {
  const [image] = useImage(url, 'anonymous');
  return image ? <KonvaImage image={image} width={width} height={height} /> : null;
};

// QR Style Options
const QR_DOT_STYLES = [
  { value: 'squares', label: 'Cuadrados' },
  { value: 'dots', label: 'Círculos' },
  { value: 'rounded', label: 'Redondeados' },
];

const QR_CORNER_STYLES = [
  { value: 'square', label: 'Cuadrado' },
  { value: 'rounded', label: 'Redondeado' },
  { value: 'dot', label: 'Circular' },
];

// QR Code Preview Component with Real QR - Renders outside canvas
const QRCodePreview = ({ element, onUpdate, canvasRef }) => {
  const size = element.qrSize || 100;
  const qrColor = element.qrColor || '#000000';
  const dotStyle = element.qrDotStyle || 'squares';
  const cornerStyle = element.qrCornerStyle || 'square';
  const cornerDotStyle = element.qrCornerDotStyle || 'square';
  const bgColor = element.qrBgColor || 'transparent';
  
  const [position, setPosition] = useState({ x: element.x, y: element.y });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setPosition({ x: element.x, y: element.y });
  }, [element.x, element.y]);

  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || containerRef.current?.contains(e.target)) {
      setIsDragging(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && canvasRef?.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - canvasRect.left - size / 2;
      const newY = e.clientY - canvasRect.top - size / 2;
      setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onUpdate({ ...element, x: position.x, y: position.y });
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, position]);

  // Calculate border radius based on style
  const getBorderRadius = () => {
    if (cornerStyle === 'rounded') return size * 0.1;
    if (cornerStyle === 'dot') return size * 0.5;
    return 0;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size,
        height: size,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 100,
        borderRadius: getBorderRadius(),
        overflow: 'hidden',
        backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor,
      }}
      className="qr-preview-container"
    >
      <QRCodeSVG
        value="https://example.com/verify/CERT-DEMO"
        size={size}
        bgColor={bgColor === 'transparent' ? 'transparent' : bgColor}
        fgColor={qrColor}
        level="M"
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

// QR Code Element for Konva Canvas (simplified placeholder)
const QRCodeElement = ({ element, isSelected, onSelect, onChange }) => {
  const groupRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const size = element.qrSize || 100;
  const qrColor = element.qrColor || '#000000';

  return (
    <>
      <Group
        ref={groupRef}
        x={element.x}
        y={element.y}
        width={size}
        height={size}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          const newSize = Math.round(size * Math.max(scaleX, scaleY));
          
          node.scaleX(1);
          node.scaleY(1);
          
          onChange({
            ...element,
            x: node.x(),
            y: node.y(),
            qrSize: Math.max(50, Math.min(400, newSize)),
          });
        }}
      >
        {/* QR Placeholder with border */}
        <Rect
          width={size}
          height={size}
          fill="white"
          stroke={qrColor}
          strokeWidth={2}
          cornerRadius={element.qrCornerStyle === 'rounded' ? size * 0.1 : element.qrCornerStyle === 'dot' ? size * 0.5 : 0}
        />
        {/* QR Pattern representation */}
        <Text
          text="QR"
          width={size}
          height={size}
          align="center"
          verticalAlign="middle"
          fontSize={size * 0.3}
          fill={qrColor}
          fontFamily="monospace"
          fontStyle="bold"
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio={true}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            const minSize = 50;
            const maxSize = 400;
            if (newBox.width < minSize || newBox.height < minSize) {
              return oldBox;
            }
            if (newBox.width > maxSize || newBox.height > maxSize) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

// Draggable Image Element for custom images (logos, signatures, etc.)
const DraggableImage = ({ element, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const [image] = useImage(element.imageUrl, 'anonymous');

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const width = element.imageWidth || 150;
  const height = element.imageHeight || 150;

  return (
    <>
      {image ? (
        <KonvaImage
          ref={shapeRef}
          image={image}
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          rotation={element.rotation || 0}
          opacity={element.opacity || 1}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => {
            onChange({
              ...element,
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
          onTransformEnd={(e) => {
            const node = shapeRef.current;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            
            node.scaleX(1);
            node.scaleY(1);
            
            onChange({
              ...element,
              x: node.x(),
              y: node.y(),
              imageWidth: Math.max(20, Math.round(width * scaleX)),
              imageHeight: Math.max(20, Math.round(height * scaleY)),
              rotation: node.rotation(),
            });
          }}
        />
      ) : (
        <Group
          x={element.x}
          y={element.y}
          width={width}
          height={height}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => {
            onChange({
              ...element,
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
        >
          <Rect
            width={width}
            height={height}
            fill="#f1f5f9"
            stroke="#cbd5e1"
            strokeWidth={2}
            dash={[5, 5]}
            cornerRadius={8}
          />
          <Text
            text="Loading..."
            width={width}
            height={height}
            align="center"
            verticalAlign="middle"
            fill="#94a3b8"
            fontSize={12}
          />
        </Group>
      )}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          keepRatio={false}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

// Draggable text element
const DraggableText = ({ element, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const displayText = element.type === 'variable' 
    ? `{${element.variable}}` 
    : element.text || 'Text';

  return (
    <>
      <Text
        ref={shapeRef}
        x={element.x}
        y={element.y}
        text={displayText}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.fontColor}
        fontStyle={`${element.bold ? 'bold' : ''} ${element.italic ? 'italic' : ''}`}
        textDecoration={element.underline ? 'underline' : ''}
        align={element.align}
        rotation={element.rotation}
        opacity={element.opacity}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          onChange({
            ...element,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={[]}
          boundBoxFunc={(oldBox, newBox) => newBox}
        />
      )}
    </>
  );
};

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const stageRef = useRef();
  const fileInputRef = useRef();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [templateName, setTemplateName] = useState('Untitled Template');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [canvasSize] = useState({ width: 1123, height: 794 }); // A4 landscape at 96 DPI

  useEffect(() => {
    if (isEdit) {
      fetchTemplate();
    }
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const response = await templatesAPI.getById(id);
      const template = response.data;
      setTemplateName(template.name);
      setBackgroundUrl(template.background_image_url);
      setElements(template.fields_config || []);
    } catch (error) {
      console.error('Failed to fetch template:', error);
      toast.error('Failed to load template');
      navigate('/templates');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: templateName,
        background_image_url: backgroundUrl,
        fields_config: elements,
        canvas_width: canvasSize.width,
        canvas_height: canvasSize.height,
      };

      if (isEdit) {
        await templatesAPI.update(id, data);
        toast.success('Template updated successfully');
      } else {
        await templatesAPI.create(data);
        toast.success('Template created successfully');
      }
      navigate('/templates');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadAPI.upload(file);
      const url = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
      setBackgroundUrl(url);
      toast.success('Background uploaded');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    }
  };

  const addElement = (type, variable = null) => {
    const isQRCode = variable === 'qr_code';
    
    const newElement = {
      id: `${Date.now()}`,
      type,
      variable,
      x: canvasSize.width / 2 - (isQRCode ? 50 : 100),
      y: canvasSize.height / 2 - (isQRCode ? 50 : 0),
      text: type === 'text' ? 'Sample Text' : null,
      fontFamily: 'Urbanist',
      fontSize: type === 'variable' && variable === 'recipient_name' ? 36 : 24,
      fontColor: '#0f172a',
      bold: false,
      italic: false,
      underline: false,
      align: 'center',
      rotation: 0,
      opacity: 1,
      // QR specific properties
      qrSize: isQRCode ? 120 : undefined,
      qrColor: isQRCode ? '#000000' : undefined,
      qrBgColor: isQRCode ? 'transparent' : undefined,
      qrCornerStyle: isQRCode ? 'square' : undefined,
      qrDotStyle: isQRCode ? 'squares' : undefined,
      qrErrorLevel: isQRCode ? 'M' : undefined,
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const addImageElement = async (file) => {
    if (!file) return;
    
    try {
      const response = await uploadAPI.upload(file);
      const url = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
      
      const newElement = {
        id: `${Date.now()}`,
        type: 'image',
        x: canvasSize.width / 2 - 75,
        y: canvasSize.height / 2 - 75,
        imageUrl: url,
        imageWidth: 150,
        imageHeight: 150,
        rotation: 0,
        opacity: 1,
      };

      setElements([...elements, newElement]);
      setSelectedId(newElement.id);
      toast.success('Imagen agregada');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error al subir imagen');
    }
  };

  const imageInputRef = useRef();

  const updateElement = useCallback((updatedElement) => {
    setElements(prev => prev.map(el => el.id === updatedElement.id ? updatedElement : el));
  }, []);

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(elements.filter(el => el.id !== selectedId));
    setSelectedId(null);
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col" data-testid="template-builder">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')} data-testid="back-btn">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-64 font-semibold"
            placeholder="Template name"
            data-testid="template-name-input"
          />
        </div>
        <Button className="btn-gold" onClick={handleSave} disabled={loading} data-testid="save-template-btn">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Template
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 pt-4 overflow-hidden">
        {/* Left Panel - Tools */}
        <Card className="w-64 flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Add Elements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Background Upload */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Background Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBackgroundUpload}
              />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-bg-btn"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Background
              </Button>
              {backgroundUrl && (
                <div className="text-xs text-muted-foreground truncate">
                  ✓ Background set
                </div>
              )}
            </div>

            {/* Add Text */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => addElement('text')}
              data-testid="add-text-btn"
            >
              <Type className="mr-2 h-4 w-4" />
              Add Text
            </Button>

            {/* Add Image */}
            <div className="space-y-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={(e) => {
                  addImageElement(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => imageInputRef.current?.click()}
                data-testid="add-image-btn"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Image
              </Button>
              <p className="text-[10px] text-muted-foreground">
                PNG, JPG, SVG - Logos, firmas, decoraciones
              </p>
            </div>

            {/* Add Variables */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Variables</Label>
              {VARIABLES.map((v) => (
                <Button
                  key={v.value}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => addElement('variable', v.value)}
                  data-testid={`add-var-${v.value}`}
                >
                  <Variable className="mr-2 h-3 w-3" />
                  {v.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Center - Canvas */}
        <div className="flex-1 bg-muted/50 rounded-lg overflow-auto flex items-center justify-center p-4">
          <div className="bg-white shadow-xl rounded-lg overflow-hidden" style={{ width: canvasSize.width * 0.7, height: canvasSize.height * 0.7 }}>
            <Stage
              ref={stageRef}
              width={canvasSize.width * 0.7}
              height={canvasSize.height * 0.7}
              scaleX={0.7}
              scaleY={0.7}
              onClick={handleStageClick}
              onTap={handleStageClick}
            >
              <Layer>
                {/* Background */}
                {backgroundUrl && (
                  <BackgroundImage url={backgroundUrl} width={canvasSize.width} height={canvasSize.height} />
                )}
                {!backgroundUrl && (
                  <Rect width={canvasSize.width} height={canvasSize.height} fill="#f8fafc" />
                )}
                
                {/* Elements */}
                {elements.map((element) => (
                  element.type === 'image' ? (
                    <DraggableImage
                      key={element.id}
                      element={element}
                      isSelected={element.id === selectedId}
                      onSelect={() => setSelectedId(element.id)}
                      onChange={updateElement}
                    />
                  ) : element.variable === 'qr_code' ? (
                    <QRCodeElement
                      key={element.id}
                      element={element}
                      isSelected={element.id === selectedId}
                      onSelect={() => setSelectedId(element.id)}
                      onChange={updateElement}
                    />
                  ) : (
                    <DraggableText
                      key={element.id}
                      element={element}
                      isSelected={element.id === selectedId}
                      onSelect={() => setSelectedId(element.id)}
                      onChange={updateElement}
                    />
                  )
                ))}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <Card className="w-72 flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Properties
              {selectedElement && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={deleteSelected}
                  data-testid="delete-element-btn"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedElement ? (
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="space-y-4 pr-4">
                  {/* Text/Variable content */}
                  {selectedElement.type === 'text' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Text Content</Label>
                      <Input
                        value={selectedElement.text || ''}
                        onChange={(e) => updateElement({ ...selectedElement, text: e.target.value })}
                        data-testid="element-text-input"
                      />
                    </div>
                  )}
                  
                  {selectedElement.type === 'variable' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Variable</Label>
                      <Select
                        value={selectedElement.variable}
                        onValueChange={(value) => updateElement({ ...selectedElement, variable: value })}
                      >
                        <SelectTrigger data-testid="element-variable-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VARIABLES.map((v) => (
                            <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Image Properties */}
                  {selectedElement.type === 'image' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Imagen</Label>
                        <div className="w-full h-24 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                          <img 
                            src={selectedElement.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <input
                          type="file"
                          accept="image/*,.svg"
                          className="hidden"
                          id="replace-image-input"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const response = await uploadAPI.upload(file);
                                const url = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
                                updateElement({ ...selectedElement, imageUrl: url });
                                toast.success('Imagen actualizada');
                              } catch (error) {
                                toast.error('Error al subir imagen');
                              }
                            }
                            e.target.value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => document.getElementById('replace-image-input')?.click()}
                        >
                          <Upload className="mr-2 h-3 w-3" />
                          Cambiar imagen
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Ancho: {selectedElement.imageWidth || 150}px</Label>
                        <Slider
                          value={[selectedElement.imageWidth || 150]}
                          onValueChange={([value]) => updateElement({ ...selectedElement, imageWidth: value })}
                          min={20}
                          max={500}
                          step={5}
                          data-testid="image-width-slider"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Alto: {selectedElement.imageHeight || 150}px</Label>
                        <Slider
                          value={[selectedElement.imageHeight || 150]}
                          onValueChange={([value]) => updateElement({ ...selectedElement, imageHeight: value })}
                          min={20}
                          max={500}
                          step={5}
                          data-testid="image-height-slider"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Rotación: {Math.round(selectedElement.rotation || 0)}°</Label>
                        <Slider
                          value={[selectedElement.rotation || 0]}
                          onValueChange={([value]) => updateElement({ ...selectedElement, rotation: value })}
                          min={-180}
                          max={180}
                          step={1}
                          data-testid="image-rotation-slider"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Opacidad: {Math.round((selectedElement.opacity || 1) * 100)}%</Label>
                        <Slider
                          value={[(selectedElement.opacity || 1) * 100]}
                          onValueChange={([value]) => updateElement({ ...selectedElement, opacity: value / 100 })}
                          min={10}
                          max={100}
                          step={5}
                          data-testid="image-opacity-slider"
                        />
                      </div>
                    </>
                  )}

                  {/* QR Code Properties */}
                  {selectedElement.variable === 'qr_code' && (
                    <>
                      {/* QR Preview */}
                      <div className="space-y-2">
                        <Label className="text-xs">Vista Previa del QR</Label>
                        <div className="flex justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <QRCodeSVG
                            value="https://verify.example.com/CERT-DEMO"
                            size={120}
                            bgColor={selectedElement.qrBgColor === 'transparent' ? 'transparent' : (selectedElement.qrBgColor || '#ffffff')}
                            fgColor={selectedElement.qrColor || '#000000'}
                            level={selectedElement.qrErrorLevel || 'M'}
                            style={{
                              borderRadius: selectedElement.qrCornerStyle === 'rounded' ? '12px' : selectedElement.qrCornerStyle === 'dot' ? '60px' : '0',
                            }}
                          />
                        </div>
                      </div>

                      {/* QR Size */}
                      <div className="space-y-2">
                        <Label className="text-xs">Tamaño: {selectedElement.qrSize || 100}px</Label>
                        <Slider
                          value={[selectedElement.qrSize || 100]}
                          onValueChange={([value]) => updateElement({ ...selectedElement, qrSize: value })}
                          min={50}
                          max={400}
                          step={10}
                          data-testid="qr-size-slider"
                        />
                      </div>
                      
                      {/* QR Color */}
                      <div className="space-y-2">
                        <Label className="text-xs">Color del QR</Label>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer shadow-sm"
                            style={{ backgroundColor: selectedElement.qrColor || '#000000' }}
                            onClick={() => document.getElementById('qr-color-picker').click()}
                          />
                          <input
                            id="qr-color-picker"
                            type="color"
                            value={selectedElement.qrColor || '#000000'}
                            onChange={(e) => updateElement({ ...selectedElement, qrColor: e.target.value })}
                            className="w-0 h-0 opacity-0"
                          />
                          <Input
                            value={selectedElement.qrColor || '#000000'}
                            onChange={(e) => updateElement({ ...selectedElement, qrColor: e.target.value })}
                            className="flex-1 font-mono text-sm"
                            data-testid="qr-color-input"
                          />
                        </div>
                      </div>

                      {/* QR Background Color */}
                      <div className="space-y-2">
                        <Label className="text-xs">Color de Fondo</Label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedElement.qrBgColor || 'transparent'}
                            onValueChange={(value) => updateElement({ ...selectedElement, qrBgColor: value })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="transparent">Transparente</SelectItem>
                              <SelectItem value="#ffffff">Blanco</SelectItem>
                              <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedElement.qrBgColor === 'custom' && (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="color"
                              value={selectedElement.qrBgCustomColor || '#ffffff'}
                              onChange={(e) => updateElement({ 
                                ...selectedElement, 
                                qrBgColor: e.target.value,
                                qrBgCustomColor: e.target.value 
                              })}
                              className="w-10 h-10 rounded cursor-pointer"
                            />
                            <Input
                              value={selectedElement.qrBgCustomColor || '#ffffff'}
                              onChange={(e) => updateElement({ 
                                ...selectedElement, 
                                qrBgColor: e.target.value,
                                qrBgCustomColor: e.target.value 
                              })}
                              className="flex-1 font-mono text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {/* QR Corner Style */}
                      <div className="space-y-2">
                        <Label className="text-xs">Estilo de Esquinas</Label>
                        <Select
                          value={selectedElement.qrCornerStyle || 'square'}
                          onValueChange={(value) => updateElement({ ...selectedElement, qrCornerStyle: value })}
                        >
                          <SelectTrigger data-testid="qr-corner-style">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QR_CORNER_STYLES.map((style) => (
                              <SelectItem key={style.value} value={style.value}>
                                {style.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* QR Dot Style */}
                      <div className="space-y-2">
                        <Label className="text-xs">Estilo de Módulos</Label>
                        <Select
                          value={selectedElement.qrDotStyle || 'squares'}
                          onValueChange={(value) => updateElement({ ...selectedElement, qrDotStyle: value })}
                        >
                          <SelectTrigger data-testid="qr-dot-style">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QR_DOT_STYLES.map((style) => (
                              <SelectItem key={style.value} value={style.value}>
                                {style.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* QR Error Correction Level */}
                      <div className="space-y-2">
                        <Label className="text-xs">Nivel de Corrección</Label>
                        <Select
                          value={selectedElement.qrErrorLevel || 'M'}
                          onValueChange={(value) => updateElement({ ...selectedElement, qrErrorLevel: value })}
                        >
                          <SelectTrigger data-testid="qr-error-level">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="L">Bajo (7%)</SelectItem>
                            <SelectItem value="M">Medio (15%)</SelectItem>
                            <SelectItem value="Q">Alto (25%)</SelectItem>
                            <SelectItem value="H">Máximo (30%)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Mayor corrección = QR más denso pero más resistente
                        </p>
                      </div>
                    </>
                  )}

                  {/* Font properties - only for non-QR elements */}
                  {selectedElement.variable !== 'qr_code' && (
                    <>
                      {/* Font Family */}
                      <div className="space-y-2">
                        <Label className="text-xs">Font Family</Label>
                        <Select
                          value={selectedElement.fontFamily}
                          onValueChange={(value) => {
                            loadGoogleFont(value);
                            updateElement({ ...selectedElement, fontFamily: value });
                          }}
                        >
                          <SelectTrigger data-testid="element-font-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            <ScrollArea className="h-72">
                              {Object.entries(GOOGLE_FONTS).map(([category, fonts]) => (
                                <SelectGroup key={category}>
                                  <SelectLabel className="text-xs font-bold text-indigo-600 px-2 py-1.5 sticky top-0 bg-white dark:bg-slate-900">
                                    {category}
                                  </SelectLabel>
                                  {fonts.map((font) => (
                                    <SelectItem 
                                      key={font} 
                                      value={font}
                                      className="pl-4"
                                      onMouseEnter={() => loadGoogleFont(font)}
                                    >
                                      <span style={{ fontFamily: font }}>{font}</span>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          {Object.values(GOOGLE_FONTS).flat().length} Google Fonts disponibles
                        </p>
                      </div>

                      {/* Font Size */}
                      <div className="space-y-2">
                        <Label className="text-xs">Font Size: {selectedElement.fontSize}px</Label>
                        <Slider
                          value={[selectedElement.fontSize]}
                          onValueChange={([value]) => updateElement({ ...selectedElement, fontSize: value })}
                          min={8}
                          max={120}
                          step={1}
                          data-testid="element-font-size-slider"
                        />
                      </div>

                      {/* Font Color */}
                      <div className="space-y-2">
                        <Label className="text-xs">Font Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={selectedElement.fontColor}
                            onChange={(e) => updateElement({ ...selectedElement, fontColor: e.target.value })}
                            className="w-12 h-10 p-1 cursor-pointer"
                            data-testid="element-color-input"
                          />
                          <Input
                            value={selectedElement.fontColor}
                            onChange={(e) => updateElement({ ...selectedElement, fontColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* Text Style Toggles */}
                      <div className="space-y-2">
                        <Label className="text-xs">Text Style</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={selectedElement.bold ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateElement({ ...selectedElement, bold: !selectedElement.bold })}
                            data-testid="element-bold-btn"
                          >
                            <Bold className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={selectedElement.italic ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateElement({ ...selectedElement, italic: !selectedElement.italic })}
                            data-testid="element-italic-btn"
                          >
                            <Italic className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={selectedElement.underline ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateElement({ ...selectedElement, underline: !selectedElement.underline })}
                            data-testid="element-underline-btn"
                          >
                            <Underline className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Text Alignment */}
                      <div className="space-y-2">
                        <Label className="text-xs">Alignment</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={selectedElement.align === 'left' ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateElement({ ...selectedElement, align: 'left' })}
                          >
                            <AlignLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={selectedElement.align === 'center' ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateElement({ ...selectedElement, align: 'center' })}
                          >
                            <AlignCenter className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={selectedElement.align === 'right' ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateElement({ ...selectedElement, align: 'right' })}
                          >
                            <AlignRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Opacity - for all elements */}
                  <div className="space-y-2">
                    <Label className="text-xs">Opacity: {Math.round(selectedElement.opacity * 100)}%</Label>
                    <Slider
                      value={[selectedElement.opacity * 100]}
                      onValueChange={([value]) => updateElement({ ...selectedElement, opacity: value / 100 })}
                      min={10}
                      max={100}
                      step={5}
                      data-testid="element-opacity-slider"
                    />
                  </div>

                  {/* Rotation - only for non-QR */}
                  {selectedElement.variable !== 'qr_code' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Rotation: {Math.round(selectedElement.rotation)}°</Label>
                      <Slider
                        value={[selectedElement.rotation]}
                        onValueChange={([value]) => updateElement({ ...selectedElement, rotation: value })}
                        min={-180}
                        max={180}
                        step={1}
                        data-testid="element-rotation-slider"
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Palette className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select an element to edit its properties</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TemplateBuilder;
