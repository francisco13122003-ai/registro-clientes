(function () {
  'use strict';

  const txPdfService = window.TxPdfService;
  const jsPDFCtor = window.jspdf?.jsPDF;

  if (!txPdfService || !jsPDFCtor) {
    console.error('No se pudo cargar TxPdfService o jsPDF para la preview.');
    return;
  }

  const mockPayload = {
    tx: {
      kind: 'factura',
      tx_date: '2026-03-18',
      total_amount: 127.9,
      comments: '',
    },
    txCode: 'FC-00001-26',
    customer: {
      is_company: true,
    },
    company: {
      business_name: 'CLIENTE DEMOSTRACION',
      address: 'CALLE PRUEBA 123',
      postal_code: '18000',
      city: 'GRANADA',
      province: '',
      cif: '12345678Z',
    },
    items: [
      { concept: 'Reparación de portátil y limpieza interna', amount: 35.0 },
      { concept: 'Sustitución de SSD Kingston 480GB', amount: 49.9 },
      { concept: 'Instalación de sistema operativo y drivers', amount: 25.0 },
      { concept: 'Configuración de correo y copia de datos del equipo anterior', amount: 18.0 },
    ],
  };

  let latestBlob = null;

  function renderPreview() {
    const data = txPdfService.buildPdfData(mockPayload);
    const doc = txPdfService.renderPdfToJsPdf(data, jsPDFCtor);
    latestBlob = doc.output('blob');

    const frame = document.getElementById('previewFrame');
    const blobUrl = URL.createObjectURL(latestBlob);
    frame.src = blobUrl;
  }

  document.getElementById('renderBtn')?.addEventListener('click', renderPreview);
  document.getElementById('downloadBtn')?.addEventListener('click', function () {
    if (!latestBlob) renderPreview();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(latestBlob);
    a.download = 'preview-fc-00001-26.pdf';
    a.click();
  });

  renderPreview();
})();
