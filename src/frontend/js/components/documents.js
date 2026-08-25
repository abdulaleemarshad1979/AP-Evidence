const DocumentsComponent = {
  activeJobId: null,
  extractions: [],

  render: async () => {
    return `
      <div class="card p-4">
        <h2 class="h4 font-weight-bold text-primary mb-3">
          <i class="fas fa-file-alt mr-2"></i>Phase 9: Unstructured Document & Multi-Format Mining Engine
        </h2>
        <p class="text-muted small">
          Ingest scanned FIRs, chargesheets, DOCX, flexible CSV column mappings, and network PCAP dumps. Extracted facts are cited and routed to human-in-the-loop candidate triage before committing to the ontology graph.
        </p>

        <ul class="nav nav-tabs mb-4" id="docTabs" role="tablist">
          <li class="nav-item">
            <a class="nav-link active" id="tab-doc-ingest" data-toggle="tab" href="#content-doc-ingest" role="tab">Document / FIR Mining</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" id="tab-csv-mapped" data-toggle="tab" href="#content-csv-mapped" role="tab">Flexible CSV Mapper</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" id="tab-pcap-dump" data-toggle="tab" href="#content-pcap-dump" role="tab">PCAP Network Telemetry</a>
          </li>
        </ul>

        <div class="tab-content" id="docTabsContent">
          <!-- TAB 1: DOCUMENT / FIR MINING -->
          <div class="tab-pane fade show active" id="content-doc-ingest" role="tabpanel">
            <div class="row">
              <div class="col-md-5">
                <div class="border rounded p-3 bg-light mb-3">
                  <h6 class="font-weight-bold text-dark mb-3">Ingest Case Sheet / Scanned FIR</h6>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Target Case</label>
                    <input type="text" id="docCaseId" class="form-control form-control-sm" value="CASE-AP-2026-0001" />
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">File Name</label>
                    <input type="text" id="docFileName" class="form-control form-control-sm" value="FIR_142_2026_Vijayawada_Central.txt" />
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Media Type</label>
                    <select id="docMediaType" class="form-control form-control-sm">
                      <option value="text/plain">Text / Plaintext Case Sheet</option>
                      <option value="application/pdf">PDF / Text-Layer Document</option>
                      <option value="image/png">Scanned Image PDF (OCR Pipeline)</option>
                    </select>
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Document Content</label>
                    <textarea id="docContentText" class="form-control form-control-sm" rows="6" placeholder="Paste case-sheet or FIR text here..."></textarea>
                  </div>
                  <div class="d-flex justify-content-between">
                    <button class="btn btn-sm btn-outline-secondary" onclick="DocumentsComponent.loadSyntheticData()">
                      <i class="fas fa-magic mr-1"></i>Load Synthetic FIR
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="DocumentsComponent.ingestDocument()">
                      <i class="fas fa-upload mr-1"></i>Ingest & Extract Facts
                    </button>
                  </div>
                </div>
              </div>

              <div class="col-md-7">
                <div class="border rounded p-3 bg-white">
                  <h6 class="font-weight-bold text-dark mb-3">Candidate Fact Extractions (<span id="candidateCount">0</span>)</h6>
                  <div id="extractionsContainer" style="max-height: 450px; overflow-y: auto;">
                    <div class="text-muted text-center py-4 small">No document ingested yet. Upload a case sheet or click "Load Synthetic FIR".</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: FLEXIBLE CSV MAPPER -->
          <div class="tab-pane fade" id="content-csv-mapped" role="tabpanel">
            <div class="border rounded p-3 bg-light">
              <h6 class="font-weight-bold text-dark mb-3">Arbitrary CSV Column Mapping</h6>
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Raw CSV Text</label>
                    <textarea id="csvRawText" class="form-control form-control-sm" rows="8" placeholder="Header line + CSV data lines..."></textarea>
                  </div>
                  <button class="btn btn-sm btn-outline-secondary mb-3" onclick="DocumentsComponent.loadSyntheticCsv()">Load Sample CDR CSV</button>
                </div>
                <div class="col-md-6">
                  <h6 class="small font-weight-bold text-secondary mb-2">Column Mapping Config</h6>
                  <div class="form-row">
                    <div class="form-group col-6 mb-2">
                      <label class="small">Timestamp Field</label>
                      <input type="text" id="mapTs" class="form-control form-control-sm" value="call_time" />
                    </div>
                    <div class="form-group col-6 mb-2">
                      <label class="small">Location/Tower</label>
                      <input type="text" id="mapLoc" class="form-control form-control-sm" value="cell_tower" />
                    </div>
                    <div class="form-group col-6 mb-2">
                      <label class="small">Latitude</label>
                      <input type="text" id="mapLat" class="form-control form-control-sm" value="latitude" />
                    </div>
                    <div class="form-group col-6 mb-2">
                      <label class="small">Longitude</label>
                      <input type="text" id="mapLng" class="form-control form-control-sm" value="longitude" />
                    </div>
                    <div class="form-group col-6 mb-2">
                      <label class="small">Entity ID / Phone</label>
                      <input type="text" id="mapEntity" class="form-control form-control-sm" value="msisdn" />
                    </div>
                    <div class="form-group col-6 mb-2">
                      <label class="small">Event Type</label>
                      <input type="text" id="mapType" class="form-control form-control-sm" value="call_type" />
                    </div>
                  </div>
                  <button class="btn btn-sm btn-success w-100 mt-2" onclick="DocumentsComponent.ingestMappedCsv()">
                    <i class="fas fa-table mr-1"></i>Ingest Mapped CSV Records
                  </button>
                </div>
              </div>
              <div id="csvResult" class="mt-3"></div>
            </div>
          </div>

          <!-- TAB 3: PCAP DUMP -->
          <div class="tab-pane fade" id="content-pcap-dump" role="tabpanel">
            <div class="border rounded p-3 bg-light">
              <h6 class="font-weight-bold text-dark mb-3">Cyber-Cell Network PCAP Telemetry Dump</h6>
              <div class="form-group mb-2">
                <label class="small font-weight-bold">PCAP Flow Log Dump</label>
                <textarea id="pcapText" class="form-control form-control-sm" rows="6" placeholder="192.168.1.100 10.0.4.15 TCP 4096..."></textarea>
              </div>
              <div class="d-flex justify-content-between">
                <button class="btn btn-sm btn-outline-secondary" onclick="DocumentsComponent.loadSyntheticPcap()">Load Sample PCAP</button>
                <button class="btn btn-sm btn-info" onclick="DocumentsComponent.ingestPcap()">
                  <i class="fas fa-network-wired mr-1"></i>Parse Network Telemetry Dump
                </button>
              </div>
              <div id="pcapResult" class="mt-3"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  loadSyntheticData: () => {
    document.getElementById('docContentText').value = `ANDHRA PRADESH POLICE DEPARTMENT
FIRST INFORMATION REPORT (Under Section 154 Cr.P.C.)
FIR No: 142/2026 | Police Station: Vijayawada Central PS | Date: 2026-08-15

Subject/Accused: SUB-00001 (K. Rajesh, alias "Rajesh Varma")
Associate: V. Sharma (+91-9876543210)
Vehicle Identified: AP-09-CB-1234 (Black SUV)
Location of Incident: Vijayawada Bus Stand Junction (Lat: 16.5062, Lng: 80.6480)
Motive / Modus Operandi: Organized financial extortion and coordinated cyber theft targeting commercial bank accounts.
Prior Arrest Record: Suspect involved in prior fraud cases at Visakhapatnam in 2024.
Network Telemetry: IP Address 192.168.1.50 accessed secure endpoint.`;
  },

  loadSyntheticCsv: () => {
    document.getElementById('csvRawText').value = `call_time,msisdn,cell_tower,latitude,longitude,call_type
2026-08-20T10:15:00Z,+91-9876543210,Vijayawada Central Tower,16.5062,80.6480,VOICE_OUTBOUND
2026-08-20T10:45:00Z,+91-9876543210,Visakhapatnam Port Tower,17.6868,83.2185,SMS_INBOUND`;
  },

  loadSyntheticPcap: () => {
    document.getElementById('pcapText').value = `192.168.1.100 10.0.4.15 TCP 4096
192.168.1.100 185.220.101.5 TOR_NODE 20480
10.0.4.15 192.168.1.105 UDP 1024`;
  },

  ingestDocument: async () => {
    const caseId = document.getElementById('docCaseId').value;
    const fileName = document.getElementById('docFileName').value;
    const mediaType = document.getElementById('docMediaType').value;
    const fileContent = document.getElementById('docContentText').value;

    if (!fileContent) {
      alert('Please enter document content or load synthetic FIR');
      return;
    }

    try {
      const res = await API.post('/api/v1/connectors/documents/ingest', {
        caseId, fileName, mediaType, fileContent
      });

      alert(`Ingested document successfully! Extracted ${res.candidateFactsCount} candidate facts.`);
      DocumentsComponent.activeJobId = res.jobId;
      await DocumentsComponent.loadExtractions(res.jobId);
    } catch (err) {
      alert('Ingestion error: ' + err.message);
    }
  },

  loadExtractions: async (jobId) => {
    try {
      const res = await API.get(`/api/v1/connectors/documents/${jobId}/extractions`);
      const container = document.getElementById('extractionsContainer');
      document.getElementById('candidateCount').innerText = res.extractions.length;

      if (!res.extractions.length) {
        container.innerHTML = '<div class="text-muted text-center py-4 small">No candidate facts extracted.</div>';
        return;
      }

      container.innerHTML = res.extractions.map(ext => `
        <div class="card mb-2 border-left-info shadow-sm p-2">
          <div class="d-flex justify-content-between align-items-start">
            <span class="badge badge-${ext.extractionType === 'ENTITY' ? 'primary' : ext.extractionType === 'OBSERVATION' ? 'success' : 'warning'} font-weight-bold">
              ${ext.extractionType} ${ext.entityType ? '(' + ext.entityType + ')' : ''}
            </span>
            <small class="text-muted">Offset ${ext.textOffset} | Pg ${ext.pageNumber}</small>
          </div>
          <div class="mt-1">
            <strong>${ext.extractedValue}</strong>
            ${ext.relationType ? '<span class="text-secondary small ml-2">[' + ext.relationType + ']</span>' : ''}
          </div>
          <div class="small text-muted font-italic mt-1 bg-light p-1 rounded">
            "${ext.snippet}"
          </div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <small class="text-muted">Confidence: ${(ext.confidenceScore * 100).toFixed(0)}% | Status: <strong>${ext.status}</strong></small>
            ${ext.status === 'PENDING_REVIEW' ? `
              <div>
                <button class="btn btn-xs btn-success" onclick="DocumentsComponent.reviewFact('${ext.id}', 'APPROVED')">
                  <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-xs btn-danger" onclick="DocumentsComponent.reviewFact('${ext.id}', 'REJECTED')">
                  <i class="fas fa-times"></i> Reject
                </button>
              </div>
            ` : `<span class="badge badge-secondary">${ext.status}</span>`}
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  reviewFact: async (id, decision) => {
    try {
      await API.post(`/api/v1/connectors/documents/extractions/${id}/review`, { decision });
      await DocumentsComponent.loadExtractions(DocumentsComponent.activeJobId);
    } catch (err) {
      alert('Review failed: ' + err.message);
    }
  },

  ingestMappedCsv: async () => {
    const csvText = document.getElementById('csvRawText').value;
    const columnMapping = {
      timestamp: document.getElementById('mapTs').value,
      locationName: document.getElementById('mapLoc').value,
      latitude: document.getElementById('mapLat').value,
      longitude: document.getElementById('mapLng').value,
      entityId: document.getElementById('mapEntity').value,
      eventType: document.getElementById('mapType').value
    };

    try {
      const res = await API.post('/api/import/csv-mapped', { csvText, columnMapping });
      document.getElementById('csvResult').innerHTML = `
        <div class="alert alert-success small mb-0">
          <i class="fas fa-check-circle mr-1"></i> Ingested batch ${res.batchId} cleanly! Processed ${res.totalRecords} mapped records.
        </div>
      `;
    } catch (err) {
      document.getElementById('csvResult').innerHTML = `<div class="alert alert-danger small mb-0">${err.message}</div>`;
    }
  },

  ingestPcap: async () => {
    const pcapData = document.getElementById('pcapText').value;
    try {
      const res = await API.post('/api/import/pcap', { pcapData });
      document.getElementById('pcapResult').innerHTML = `
        <div class="alert alert-success small mb-0">
          <i class="fas fa-network-wired mr-1"></i> Ingested PCAP dump batch ${res.batchId}! Extracted ${res.indicatorsExtracted} flow indicators.
        </div>
      `;
    } catch (err) {
      document.getElementById('pcapResult').innerHTML = `<div class="alert alert-danger small mb-0">${err.message}</div>`;
    }
  }
};
