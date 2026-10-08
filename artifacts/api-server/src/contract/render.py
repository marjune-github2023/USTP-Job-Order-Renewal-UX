"""Render the supplied USTP contract layout with approved application data.
Input is JSON on stdin; output is PDF bytes on stdout. No temporary applicant files.
"""
import io
import json
import re
import sys
from datetime import date
from decimal import Decimal
from html import escape
from pathlib import Path
import pymupdf

ASSETS = Path(__file__).resolve().parent

def text(value):
    return escape(str(value), quote=True)

def chancellor_name(value):
    # Older forms asked for "name and title"; remove only the known fixed
    # designation, retaining the person's name and academic credentials.
    return re.sub(r'(?:\s+|[,;]\s*)USTP\s+Claveria\s*,?\s*Chancellor[\s.,]*$', '', value.strip(), flags=re.IGNORECASE).rstrip(' ,;')

def id_number(value):
    # The label belongs to the template, even when pasted into an ID field.
    return re.sub(r'^(?:\s*Valid\s+ID\s*/\s*No\.?\s*:?\s*)+', '', value, flags=re.IGNORECASE).strip()

def signature_name(value):
    return f'<b><u>{text(value)}</u></b>'

def number_words(n):
    small = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
    tens = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
    if n < 20: return small[n]
    if n < 100: return tens[n // 10] + ('-' + small[n % 10] if n % 10 else '')
    if n < 1000: return small[n // 100] + ' hundred' + (' ' + number_words(n % 100) if n % 100 else '')
    return number_words(n // 1000) + ' thousand' + (' ' + number_words(n % 1000) if n % 1000 else '')

def long_date(value):
    d = date.fromisoformat(value)
    return f'{d:%B} {d.day}, {d.year}'

def signed_date(value):
    d = date.fromisoformat(value)
    suffix = 'th' if 10 <= d.day % 100 <= 20 else {1:'st',2:'nd',3:'rd'}.get(d.day % 10,'th')
    return f'{d.day}{suffix} day of {d:%B}, {d.year}'

def alpha(index):
    result = ''
    while index >= 0:
        result = chr(97 + index % 26) + result
        index = index // 26 - 1
    return result

def render(data):
    personal, contract = data['personal_details'], data['contract_details']
    name = text(personal['full_name'].upper())
    chancellor = chancellor_name(contract['chancellor'])
    nationality = text(personal.get('nationality', '')) + ', ' if personal.get('nationality') else ''
    period = 'for the period from' if data.get('form_version') == 2 else f"for a period of {text(contract['duration'])}, from"
    supervisor_title = text(contract.get('supervisor_position') or 'Immediate Supervisor')
    entered = text(signed_date(contract['contract_date']))
    wage = Decimal(contract['daily_rate'])
    amount = text(f'{number_words(int(wage)).upper()} & {int(wage * 100) % 100:02d}/100 (PhP {wage:,.2f})')
    clauses = json.loads((ASSETS / 'clauses.json').read_text())
    html = f'''<p class="opening">Know All Men by These Presents:</p>
    <p>This Job Order Contract is entered this <u>{entered}</u>, by and between:</p>
    <p>The <b>UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES-CLAVERIA</b>, a state university, existing and organized under the laws of the Republic of the Philippines, and created by virtue of Republic Act No. 10919, with principal address at Magsaysay Street, Poblacion, Claveria, Misamis Oriental, represented by its Chancellor, {text(chancellor)}, hereinafter referred to as the “USTP”;</p>
    <p class="center">-and-</p>
    <p><b><u>{name}</u></b>, {nationality}of legal age, {text(personal['civil_status'])}, with residence address at <u>{text(personal['address'])}</u> hereinafter referred to as the <b>“WORKER”</b></p>
    <p class="center">Witnesseth:</p>
    <p><b>WHEREAS,</b> in order to meet the organizational and staffing requirements vis-a-vis existing manpower complement, as well as to not impair the delivery of government service, USTP, engage the services of Job Order workers in accordance with the provisions of COA-DBM JC No. 2 s. 2020 and COA-DBM JC No. 2 s. 2022, as amended;</p>
    <p><b>WHEREAS,</b> USTP need the services of Job Order workers, who shall perform work not performed by its regular personnel as learning service provider;</p>
    <p><b>WHEREAS,</b> WORKER has signified intention to provide the services needed by USTP and enter into a Job Order contract, to which the latter accepted;</p>
    <p><b>NOW THEREFORE,</b> for and in consideration of the foregoing premises, the parties hereby agree and covenant to be bound by the terms set forth in this Contract, to wit:</p>
    <div class="clause"><p>1. USTP engage the services of the WORKER, as <u>{text(data['position'])}</u> on a Job Order basis {period} <u>{text(long_date(data['start_date']))}</u> to <u>{text(long_date(data['end_date']))}</u> in the <u>{text(data['office'])}</u>.</p>
    <p>2. The WORKER shall render at least Forty (40) hours of service per week divided into eight (8) hours per day from 8:00 AM to 5:00 PM exclusive of one (1) hour lunch break, from Mondays to Fridays, and to perform the following duties and responsibilities:</p>'''
    if data.get('form_version') == 2:
        for i, duty in enumerate(data['tor_items'], 1):
            html += f'<p class="function">2.{i} {text(duty)}</p>'
    else:
        for si, section in enumerate(data['tor_sections'],1):
            html += f'<p class="section">2.{si} {text(section["title"])} ({section["weight"]}%)</p>'
            for fi, function in enumerate(section['functions'],1):
                html += f'<p class="function">2.{si}.{fi} {text(function["text"])}</p>'
                for ai, activity in enumerate(function['activities']):
                    html += f'<p class="activity">2.{si}.{fi}.{alpha(ai)} {text(activity)}</p>'
    html += f'<p>3. The WORKER shall receive a remuneration of <b>{amount}</b> Philippine Currency, on a daily wage basis. The number of compensable days in a month shall not exceed Twenty-two (22) days. Any excess thereof which of necessity must be rendered to meet the work requirement as stipulated in item 2 of this contract may be applied as an extension of service.</p>'
    for n, clause in clauses.items():
        parts = re.split(r'(?=\b(?:5\.[123]|11\.[12]) )', clause)
        html += f'<p>{n}. {text(parts[0].strip())}</p>'
        for part in parts[1:]: html += f'<p class="function">{text(part.strip())}</p>'
    html += '</div>'
    signatures = f'''<div class="signatures"><p><i><b>IN WITNESS WHEREOF,</b></i> the parties hereunder affixed their signatures this <u>{entered}</u> at Magsaysay St., Poblacion, Claveria Misamis Oriental, Philippines.</p>
    <table><tr><td><i>For the</i><br/>USTP</td><td>WORKER</td></tr>
    <tr><td><br/><br/>{signature_name(chancellor)}<br/>USTP Claveria, Chancellor<br/>Valid ID/No.: {text(id_number(contract['chancellor_id']))}</td><td><br/><br/><b><u>{name}</u></b><br/>Valid ID/No.: {text(id_number(personal['valid_id']))}</td></tr>
    <tr><td><br/><br/><b><u>{text(contract['supervisor'])}</u></b><br/>{supervisor_title}</td><td><br/><br/>{signature_name(contract['hrmo_director'])}<br/>HRMO Director</td></tr>
    <tr><td></td><td><br/>Funds Available:<br/><br/><br/>{signature_name(contract['finance_director'])}<br/>Director, Finance Management Services</td></tr></table></div>'''
    css = '''body {font-family:serif;font-size:11pt;line-height:1.15;margin:0;} p{text-align:justify;text-indent:36pt;margin:0 0 13pt;} .opening{text-indent:0;} .center{text-align:center;text-indent:0;} .clause{margin-left:36pt;} .clause p{text-indent:0;} .section{margin-left:4pt;margin-bottom:2pt;font-weight:bold;} .function{margin-left:24pt;margin-bottom:2pt;} .activity{margin-left:42pt;margin-bottom:2pt;} .signatures{page-break-inside:avoid;} table{width:100%;font-size:11pt;} td{width:50%;text-align:center;vertical-align:top;padding:4pt;overflow-wrap:break-word;}'''
    story = pymupdf.Story(html=html,user_css=css)
    signature_story = pymupdf.Story(html=signatures,user_css=css)
    buffer = io.BytesIO()
    writer = pymupdf.DocumentWriter(buffer)
    page_index = 0
    while True:
        if page_index >= 60: raise ValueError('Contract is too long')
        device = writer.begin_page(pymupdf.Rect(0,0,612,936))
        more, filled = story.place(pymupdf.Rect(72,154 if page_index == 0 else 36,540,894))
        story.draw(device)
        page_index += 1
        if not more:
            signature_more, _ = signature_story.place(pymupdf.Rect(72,min(filled[3]+16,893),540,894))
            if signature_more:
                signature_story.reset()
                writer.end_page()
                device = writer.begin_page(pymupdf.Rect(0,0,612,936))
                signature_more, _ = signature_story.place(pymupdf.Rect(72,36,540,894))
                if signature_more: raise ValueError('Signature block does not fit')
            signature_story.draw(device)
            writer.end_page()
            break
        writer.end_page()
    writer.close()
    document = pymupdf.open(stream=buffer.getvalue(),filetype='pdf')
    header = pymupdf.open(ASSETS / 'letterhead.pdf')
    document[0].show_pdf_page(pymupdf.Rect(0,0,612,154),header,0)
    for i in range(1,len(document)):
        document[i].insert_text((535,24),str(i+1),fontsize=10,fontname='tiro')
    acknowledgment = pymupdf.open(ASSETS / 'acknowledgment.pdf')
    document.insert_pdf(acknowledgment)
    document.set_metadata({'title':'Job Order Contract','author':'USTP Claveria','subject':'Approved Job Order renewal contract'})
    return document.tobytes(garbage=4,deflate=True)

if __name__ == '__main__':
    sys.stdout.buffer.write(render(json.load(sys.stdin)))
