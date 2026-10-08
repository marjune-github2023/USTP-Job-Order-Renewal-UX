"""Layout and content checks for generated PDF output; synthetic data only."""
import copy
import importlib.util
import json
import pathlib
import sys
import unicodedata
import pymupdf

root = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('contract_renderer', root / 'src/contract/render.py')
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
fixture = {
    'position': 'Computer Maintenance Technologist', 'office': 'Office of Information and Communication Technology',
    'start_date': '2026-10-01', 'end_date': '2026-12-31',
    'personal_details': {'full_name': 'Alex Example', 'nationality': 'Filipino', 'civil_status': 'single', 'address': '123 Example Street, Claveria, Misamis Oriental', 'valid_id': 'SAMPLE-ID-001'},
    'contract_details': {'contract_date':'2026-10-01','daily_rate':'1227.27','duration':'Three months','chancellor':'Example Chancellor, Ph.D.','chancellor_id':'SAMPLE-ID-002','supervisor':'Example Supervisor','hrmo_director':'Example HRMO Director','finance_director':'Example Finance Director, CPA'},
    'tor_sections': [
        {'title':'Core Functions','weight':90,'functions':[{'text':'Maintain campus ICT services','activities':['Monitor primary internet connectivity.','Maintain computers and network equipment.','Prepare monthly service reports.']}]},
        {'title':'Mandatory Support Functions','weight':10,'functions':[{'text':'Support campus operations','activities':['Attend the general assembly.','Submit daily time records on time.']}]}
    ]
}
def inspect(pdf, required):
    doc = pymupdf.open(stream=pdf,filetype='pdf')
    content = unicodedata.normalize('NFKC',' '.join(' '.join(page.get_text(clip=pymupdf.Rect(0,30,612,936)).split()) for page in doc))
    assert len(doc) >= 3
    for value in required: assert value in content, value
    for value in ['MARJUNE', 'ABREGANA', 'P0533155c','01-11-0289','July 2024','2024']: assert value not in content, value
    for page in doc:
        assert page.rect == pymupdf.Rect(0,0,612,936)
        for word in page.get_text('words'):
            assert word[0] >= 0 and word[2] <= 612.1 and word[1] >= 0 and word[3] <= 936.1, word
    assert 'ACKNOWLEDGMENT' in doc[-1].get_text()
    assert all(value in doc[-2].get_text() for value in ['Example Finance Director','Example Chancellor','Valid ID/No.']), 'Signature block must stay together before acknowledgment'
    for clause in json.loads((root/'src/contract/clauses.json').read_text()).values():
        assert ' '.join(clause.split()) in content, 'Missing or altered fixed legal clause'
    return doc
pdf = renderer.render(fixture)
doc = inspect(pdf,['ALEX EXAMPLE','2.1.1.a','2.2.1.b','1,227.27','TWENTY-SEVEN & 27/100','October 1, 2026','December 31, 2026','SAMPLE-ID-001'])
if len(sys.argv)>1:
    output=pathlib.Path(sys.argv[1]);output.mkdir(parents=True,exist_ok=True)
    (output/'sample-contract.pdf').write_bytes(pdf)
    doc[0].get_pixmap(matrix=pymupdf.Matrix(1.2,1.2)).save(output/'contract-page-1.png')
    doc[-2].get_pixmap(matrix=pymupdf.Matrix(1.2,1.2)).save(output/'contract-signatures.png')
long=copy.deepcopy(fixture)
long['personal_details']['full_name']='Alex <Example> & Peña'
long['tor_sections'][0]['functions']=[{'text':f'Function {i}: Maintain systems with reliable operations and documented procedures.', 'activities':[f'Activity {i}-{j}: '+ 'Coordinate maintenance and record service outcomes. '*4 for j in range(8)]} for i in range(24)]
long_pdf=renderer.render(long)
long_doc=inspect(long_pdf,['ALEX <EXAMPLE> & PEÑA','2.1.24.h','Activity 23-7:'])
assert len(long_doc)>len(doc)
print(f'PASS: sample {len(doc)} pages; long TOR {len(long_doc)} pages; page bounds, all legal clauses, Unicode, HTML escaping, signature block and acknowledgment verified.')

# Regression: pasted designation and ID labels from the source contract must
# not become part of the underlined name or repeat in the signature block.
pasted = copy.deepcopy(fixture)
pasted['contract_details']['chancellor'] = 'Example Chancellor, Ph.D. USTP CLAVERIA, CHANCELLOR'
pasted['contract_details']['chancellor_id'] = 'Valid ID/No.: Valid ID/No.: SAMPLE-ID-002'
pasted['personal_details']['valid_id'] = 'Valid ID/No.: SAMPLE-ID-001'
pasted_doc = inspect(renderer.render(pasted), ['Example Chancellor, Ph.D.', 'SAMPLE-ID-002'])
signatures = pasted_doc[-2]
assert signatures.get_text().count('USTP Claveria, Chancellor') == 1
assert signatures.get_text().count('Valid ID/No.:') == 2  # One for each party.
assert 'Valid ID/No.: Valid' not in signatures.get_text()
assert 'PH.D.' not in signatures.get_text()  # Preserve academic credential case.
lines = []
for drawing in signatures.get_drawings():
    if drawing['rect'].height < 0.2:
        rect = drawing['rect']
        lines.append((rect.x0,rect.x1,rect.y0))
    for item in drawing['items']:
        if item[0] == 'l' and abs(item[1].y-item[2].y) < 0.2:
            lines.append((min(item[1].x,item[2].x), max(item[1].x,item[2].x),item[1].y))
def underlined(rect):
    return any(x1 <= rect.x0+1 and x2 >= rect.x1-1 and rect.y0+rect.height*0.55 <= y <= rect.y1+1 for x1,x2,y in lines)
name_rect = signatures.search_for('Example Chancellor, Ph.D.')[0]
role_rect = signatures.search_for('USTP Claveria, Chancellor')[0]
assert underlined(name_rect), 'Chancellor name must be underlined'
assert not underlined(role_rect), 'Designation must not be underlined'
for role in ['HRMO Director','Director, Finance Management Services']:
    assert not underlined(signatures.search_for(role)[-1]), role
if len(sys.argv)>1:
    signatures.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).save(pathlib.Path(sys.argv[1])/'signature-regression.png')
print('PASS: Chancellor designation separate, name-only underline, credential casing and single ID labels.')

# Google Form records use a flat duty list and a supervisor designation.
profile = copy.deepcopy(fixture)
profile['form_version'] = 2
profile['personal_details']['nationality'] = ''
profile['personal_details']['full_name'] = 'Alex Example III'
profile['personal_details']['valid_id'] = 'USTP-TEST-01'
profile['contract_details']['supervisor_position'] = 'Director, ICT Office'
profile['contract_details']['duration'] = ''
profile['tor_sections'] = []
profile['tor_items'] = ['Maintain connectivity.', 'Prepare monthly reports <accurately> & on time.']
profile_pdf = renderer.render(profile)
profile_doc = inspect(profile_pdf, ['ALEX EXAMPLE III','2.1 Maintain connectivity.','2.2 Prepare monthly reports <accurately> & on time.','Director, ICT Office','USTP-TEST-01','for the period from'])
assert ', , of legal age' not in ' '.join(page.get_text() for page in profile_doc)
profile['tor_items'] = ['Duty '+str(i)+': '+'Perform assigned maintenance and reporting activities. '*16 for i in range(30)]
inspect(renderer.render(profile), ['Duty 29:', 'Director, ICT Office'])
if len(sys.argv)>1:
    (pathlib.Path(sys.argv[1])/'google-form-contract.pdf').write_bytes(profile_pdf)
print('PASS: Google Form duty numbering, supervisor designation, USTP ID, name suffix, date range and 30 long duties.')
