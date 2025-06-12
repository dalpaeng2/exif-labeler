import { useState, useRef, useEffect } from 'react';
import './App.css';
import ExifReader from 'exifreader';
import { saveAs } from 'file-saver';
import { FaUpload, FaDownload, FaCog, FaImage, FaTrash } from 'react-icons/fa';

interface ExifData {
  Make?: string;
  Model?: string; // 모든 태그를 표시하되, 객체나 배열이 아닌 값만 표시ime?: string;
  ExposureTime?: string;
  FNumber?: string;
  ISOSpeedRatings?: string;
  [key: string]: any;
}

function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [selectedExifTags, setSelectedExifTags] = useState<{
    [key: string]: boolean;
  }>({
    Make: true,
    Model: true,
    // DateTime: true,
    // DateTimeOriginal: true,
    ExposureTime: true,
    FNumber: true,
    ISOSpeedRatings: true,
    ISO: true,
    // FocalLength: true,
    // FocalLengthIn35mmFilm: true,
  });
  const [showSettings, setShowSettings] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 초기화 함수 - 모든 상태를 초기 상태로 돌려놓습니다
  const handleReset = () => {
    setSelectedImage(null);
    setExifData(null);
    setProcessedImage(null);
    setSelectedExifTags({
      Make: true,
      Model: true,
      ExposureTime: true,
      FNumber: true,
      ISOSpeedRatings: true,
      ISO: true,
    });
    // 파일 입력값도 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 파일 선택 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setSelectedImage(imageUrl);

      // EXIF 데이터 추출을 위해 ArrayBuffer로 다시 읽기
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        try {
          const tags = ExifReader.load(e.target?.result as ArrayBuffer);

          // ExifData 객체로 변환
          const exifData: ExifData = {};

          // 필요한 EXIF 태그 추출
          Object.entries(tags).forEach(([key, value]) => {
            // ExifReader 태그는 일반적으로 description 또는 value 속성을 가집니다
            if (value && typeof value === 'object') {
              if ('description' in value) {
                exifData[key] = value.description;
              } else if ('value' in value) {
                // @ts-expect-error - 동적 속성 접근
                exifData[key] = value.value;
              }
            }
          });

          setExifData(exifData);

          // 새로운 EXIF 태그를 체크박스 상태에 추가
          const newTags = Object.keys(exifData).reduce((acc, tag) => {
            acc[tag] =
              selectedExifTags[tag] !== undefined
                ? selectedExifTags[tag]
                : false;
            return acc;
          }, {} as { [key: string]: boolean });

          // 기본적으로 중요한 태그들은 선택
          const importantTags = [
            'Make',
            'Model',
            'ExposureTime',
            'FNumber',
            'ISOSpeedRatings',
          ];
          importantTags.forEach((tag) => {
            if (exifData[tag]) {
              newTags[tag] = true;
            }
          });

          setSelectedExifTags(newTags);
          console.log('EXIF 데이터:', exifData);
        } catch (error) {
          console.error('EXIF 데이터를 읽는 중 오류 발생:', error);
        }
      };

      fileReader.readAsArrayBuffer(file);
    };

    reader.readAsDataURL(file);
  };

  // EXIF 태그 체크박스 핸들러
  const handleCheckboxChange = (tag: string) => {
    setSelectedExifTags((prev) => ({
      ...prev,
      [tag]: !prev[tag],
    }));
  };

  // 이미지 처리 및 EXIF 정보 추가
  useEffect(() => {
    if (!selectedImage || !exifData) return;

    const image = new Image();
    image.onload = () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 이미지 크기 설정
      const imageWidth = image.width;
      const imageHeight = image.height;

      // 선택된 태그는 이제 사용하지 않음 (특정 태그만 사용)

      // 이미지 크기에 비례하여 폰트 크기 계산
      const baseFontSize = Math.max(120, Math.min(16, imageWidth / 50));
      const contentFontSize = Math.round(baseFontSize);

      // 폰트 크기에 비례하여 레터박스 높이 계산
      const lineHeight = Math.round(contentFontSize * 1.5); // 한 줄의 높이

      // 사용자가 선택한 EXIF 태그만 추출하고 포맷팅
      const filteredValues = Object.keys(selectedExifTags)
        .filter((tag) => selectedExifTags[tag] && exifData[tag])
        .map((tag) => {
          let displayValue = exifData[tag];
          if (tag === 'ExposureTime') {
            displayValue = `${displayValue}s`;
          } else if (tag === 'FNumber') {
            displayValue = `${displayValue}`;
          } else if (tag === 'ISOSpeedRatings' || tag === 'ISO') {
            displayValue = `ISO ${displayValue}`;
          }

          return displayValue;
        })
        .filter(Boolean);

      // 값들을 ' | '로 결합 (필터링된 값이 있는 경우에만)
      const exifText =
        filteredValues.length > 0 ? filteredValues.join(' | ') : '';

      // 텍스트 길이에 따라 한 줄 또는 두 줄로 분리
      ctx.font = `${contentFontSize}px Arial`;
      const maxLineWidth = imageWidth - 40; // 양쪽 여백 20씩
      const textMetrics = ctx.measureText(exifText);

      // 레터박스 여백 계산
      const verticalPadding = Math.round(contentFontSize * 1.2); // 상하 여백
      const textHeight =
        textMetrics.width <= maxLineWidth
          ? lineHeight // 한 줄
          : lineHeight * 2; // 두 줄

      // 레터박스 크기 계산 (이미지 전체를 감싸는 형태)
      const bottomBoxHeight = verticalPadding * 2 + textHeight;
      const sideBoxWidth = Math.round(bottomBoxHeight * 0.3); // 좌우 여백 증가 (30%)
      const topBoxHeight = Math.round(bottomBoxHeight * 0.3); // 상단 여백 증가 (30%)

      // 새로운 캔버스 크기 계산 (레터박스 포함)
      const newWidth = imageWidth + sideBoxWidth * 2;
      const newHeight = imageHeight + bottomBoxHeight + topBoxHeight;

      // 캔버스 크기 설정
      canvas.width = newWidth;
      canvas.height = newHeight;

      // 배경색 (흰색 레터박스) 그리기
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, newWidth, newHeight);

      // 원본 이미지를 레터박스 내부에 그리기
      ctx.drawImage(image, sideBoxWidth, topBoxHeight, imageWidth, imageHeight);

      // EXIF 정보 출력 설정
      if (filteredValues.length > 0) {
        ctx.fillStyle = '#444444'; // 진한 회색
        ctx.font = `${contentFontSize}px Arial`;

        // 중앙 정렬을 위한 텍스트 측정
        if (textMetrics.width <= maxLineWidth) {
          // 한 줄에 출력 가능한 경우
          const xPos = (newWidth - textMetrics.width) / 2; // 중앙 정렬
          const yPos =
            topBoxHeight + imageHeight + verticalPadding + contentFontSize;
          ctx.fillText(exifText, xPos, yPos);
        } else {
          // 두 줄로 나누어 출력
          const halfLength = Math.ceil(filteredValues.length / 2);
          const firstLine = filteredValues.slice(0, halfLength).join(' | ');
          const secondLine = filteredValues.slice(halfLength).join(' | ');

          // 각 줄의 너비 측정
          const firstLineMetrics = ctx.measureText(firstLine);
          const secondLineMetrics = ctx.measureText(secondLine);

          // 각 줄의 x 위치 계산 (중앙 정렬)
          const firstLineX = (newWidth - firstLineMetrics.width) / 2;
          const secondLineX = (newWidth - secondLineMetrics.width) / 2;

          // 각 줄의 y 위치 계산
          const firstLineY =
            topBoxHeight + imageHeight + verticalPadding + contentFontSize;
          const secondLineY = firstLineY + lineHeight;

          ctx.fillText(firstLine, firstLineX, firstLineY);
          ctx.fillText(secondLine, secondLineX, secondLineY);
        }
      }

      // 처리된 이미지 저장
      setProcessedImage(canvas.toDataURL('image/jpeg'));
    };

    image.src = selectedImage;
  }, [selectedImage, exifData, selectedExifTags]);

  // 이미지 다운로드 처리
  const handleDownload = () => {
    if (!processedImage) return;

    const blobUrl = processedImage.replace('data:image/jpeg;base64,', '');
    const byteString = atob(blobUrl);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: 'image/jpeg' });
    saveAs(blob, 'exif_labeled_image.jpg');
  };

  // 이미지 업로드 버튼 클릭 핸들러
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>EXIF 레이블러</h1>
        <p>이미지에 EXIF 정보를 추가하세요</p>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <button className="upload-btn" onClick={handleUploadClick}>
            <FaUpload /> 이미지 업로드
          </button>

          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            <FaCog /> EXIF 설정
          </button>

          {selectedImage && (
            <button className="reset-btn" onClick={handleReset}>
              <FaTrash /> 초기화
            </button>
          )}
        </div>

        {showSettings && exifData && (
          <div className="settings-panel">
            <h3>표시할 EXIF 정보 선택</h3>
            <div className="checkbox-group">
              {Object.keys(exifData)
                .filter(
                  (tag) =>
                    typeof exifData[tag] !== 'object' ||
                    Array.isArray(exifData[tag])
                )
                .filter((tag) =>
                  [
                    'Make',
                    'Model',
                    'ExposureTime',
                    'FNumber',
                    'ISOSpeedRatings',
                  ].includes(tag)
                )
                .map((tag) => (
                  <div key={tag} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`tag-${tag}`}
                      checked={!!selectedExifTags[tag]}
                      onChange={() => handleCheckboxChange(tag)}
                    />
                    <label htmlFor={`tag-${tag}`}>{tag}</label>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="preview-section">
          {selectedImage ? (
            <>
              <div className="image-preview">
                <div className="original-image">
                  <h3>원본 이미지</h3>
                  <img src={selectedImage} alt="원본 이미지" />
                </div>

                <div className="processed-image">
                  <h3>처리된 이미지</h3>
                  {processedImage ? (
                    <img src={processedImage} alt="EXIF 정보가 추가된 이미지" />
                  ) : (
                    <div className="loading">이미지 처리 중...</div>
                  )}
                </div>
              </div>

              {processedImage && (
                <button className="download-btn" onClick={handleDownload}>
                  <FaDownload /> 이미지 다운로드
                </button>
              )}
            </>
          ) : (
            <div className="no-image">
              <FaImage />
              <p>이미지를 업로드하면 미리보기가 표시됩니다</p>
            </div>
          )}
        </div>
      </main>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;
