import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { RecipeExportData } from '@/types';

export const exportRecipePDF = async (recipe: RecipeExportData) => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Helper function to add text with word wrapping
    const addWrappedText = (text: string, fontSize: number, fontStyle: 'normal' | 'bold' = 'normal', maxW: number = maxWidth) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', fontStyle);
      const lines = pdf.splitTextToSize(text, maxW);
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * (fontSize / 3);
      return yPosition;
    };

    const checkPageBreak = (additionalSpace: number = 10) => {
      if (yPosition + additionalSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
    };

    // Title
    checkPageBreak(20);
    addWrappedText(recipe.title, 20, 'bold');
    yPosition += 5;

    // Recipe Info
    checkPageBreak(15);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const infoText = `Type: ${recipe.type} | Préparation: ${recipe.preparationTime} min | Cuisson: ${recipe.cookingTime} min`;
    const infoLines = pdf.splitTextToSize(infoText, maxWidth);
    pdf.text(infoLines, margin, yPosition);
    yPosition += infoLines.length * 3.5 + 5;

    if (recipe.departementName) {
      checkPageBreak(10);
      addWrappedText(`Région: ${recipe.departementName}`, 10);
    }

    // Add main image if available
    if (recipe.images && recipe.images.length > 0) {
      checkPageBreak(80);
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = recipe.images[0];

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = await html2canvas(document.createElement('canvas'));
        const imgWidth = maxWidth;
        const imgHeight = (img.height / img.width) * imgWidth;

        if (imgHeight < 60) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imgData = canvas.toDataURL('image/jpeg', 0.8);
              const finalHeight = Math.min(imgHeight, 60);
              pdf.addImage(imgData, 'JPEG', margin, yPosition, imgWidth, finalHeight);
              yPosition += finalHeight + 5;
            }
          } catch (e) {
            // Skip image if error
          }
        }
      } catch (error) {
        // Skip image if it fails to load
      }
    }

    // Recipe Parts
    recipe.recipeParts.forEach((part, partIndex) => {
      checkPageBreak(15);
      yPosition += 5;
      addWrappedText(part.title, 14, 'bold');
      yPosition += 3;

      // Ingredients
      checkPageBreak(10);
      addWrappedText('Ingrédients:', 11, 'bold');
      yPosition += 2;

      part.ingredients.forEach((ingredient) => {
        checkPageBreak(5);
        const ingredientText = `• ${ingredient.name}: ${ingredient.quantity} ${ingredient.unit}`;
        const ingLines = pdf.splitTextToSize(ingredientText, maxWidth - 5);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(ingLines, margin + 5, yPosition);
        yPosition += ingLines.length * 3.5;
      });

      yPosition += 3;

      // Steps
      checkPageBreak(10);
      addWrappedText('Étapes de préparation:', 11, 'bold');
      yPosition += 2;

      part.steps.forEach((step, stepIndex) => {
        checkPageBreak(5);
        const stepText = `${stepIndex + 1}. ${step}`;
        const stepLines = pdf.splitTextToSize(stepText, maxWidth - 5);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(stepLines, margin + 5, yPosition);
        yPosition += stepLines.length * 3.5;
      });

      yPosition += 5;
    });

    // Footer
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(150, 150, 150);
    pdf.text('Recette imprimée depuis Cuisine Artisanale', margin, pageHeight - 10);

    const fileName = `${recipe.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw error;
  }
};

export const printRecipe = (recipe: RecipeExportData) => {
  try {
    const printWindow = window.open('', '', 'height=700,width=900');
    if (!printWindow) throw new Error('Could not open print window');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${recipe.title}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              color: #333;
              max-width: 900px;
              margin: 0 auto;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 3px solid #e74c3c;
              padding-bottom: 10px;
            }
            .recipe-info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              display: flex;
              gap: 30px;
              flex-wrap: wrap;
            }
            .info-item {
              flex: 1;
              min-width: 150px;
            }
            .info-item strong {
              color: #e74c3c;
            }
            .recipe-part {
              margin: 30px 0;
              page-break-inside: avoid;
            }
            .recipe-part h2 {
              color: #2c3e50;
              border-left: 4px solid #e74c3c;
              padding-left: 10px;
              margin-top: 30px;
            }
            .ingredients, .steps {
              margin: 20px 0;
            }
            .ingredients h3, .steps h3 {
              color: #34495e;
              text-transform: uppercase;
              font-size: 14px;
              letter-spacing: 1px;
            }
            .ingredients ul {
              list-style: none;
              padding: 0;
            }
            .ingredients li {
              padding: 8px 0;
              border-bottom: 1px solid #ecf0f1;
            }
            .ingredients li:before {
              content: "✓ ";
              color: #e74c3c;
              font-weight: bold;
              margin-right: 10px;
            }
            .steps ol {
              padding-left: 25px;
            }
            .steps li {
              margin: 15px 0;
              line-height: 1.6;
            }
            .main-image {
              max-width: 100%;
              height: auto;
              margin: 20px 0;
              border-radius: 5px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .footer {
              text-align: center;
              color: #95a5a6;
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #ecf0f1;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .recipe-part { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${recipe.title}</h1>

          <div class="recipe-info">
            <div class="info-item">
              <strong>Type:</strong> ${recipe.type}
            </div>
            <div class="info-item">
              <strong>Préparation:</strong> ${recipe.preparationTime} min
            </div>
            <div class="info-item">
              <strong>Cuisson:</strong> ${recipe.cookingTime} min
            </div>
            ${recipe.departementName ? `
            <div class="info-item">
              <strong>Région:</strong> ${recipe.departementName}
            </div>
            ` : ''}
          </div>

          ${recipe.images && recipe.images.length > 0 ? `
            <img src="${recipe.images[0]}" alt="${recipe.title}" class="main-image" />
          ` : ''}

          ${recipe.recipeParts.map((part, idx) => `
            <div class="recipe-part">
              <h2>${part.title}</h2>

              <div class="ingredients">
                <h3>Ingrédients</h3>
                <ul>
                  ${part.ingredients.map(ing => `
                    <li>${ing.name} : ${ing.quantity} ${ing.unit}</li>
                  `).join('')}
                </ul>
              </div>

              <div class="steps">
                <h3>Étapes de préparation</h3>
                <ol>
                  ${part.steps.map(step => `
                    <li>${step}</li>
                  `).join('')}
                </ol>
              </div>
            </div>
          `).join('')}

          <div class="footer">
            <p>Recette imprimée depuis Cuisine Artisanale</p>
            <p>${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);

    return true;
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    throw error;
  }
};

