"""
Synthetic data generator for Ahmedabad Municipal Corporation (AMC) Waste Management.
Creates 250 authentic landmark bins across 5 AMC administrative zones,
backfills historical hourly fill readings with high-speed bulk inserts,
creates AMC collection vehicles, and generates initial alerts.
"""
import random
import datetime
import math
from sqlalchemy.orm import Session
from app.models import Bin, FillReading, Vehicle, Alert, WasteType

CENTER_LAT = 23.0225
CENTER_LNG = 72.5714

# 250 Authentic Ground-Truth Ahmedabad Landmark Bins (50 per AMC Zone)
AHMEDABAD_LANDMARK_BINS = [
    # ── West Zone (Navrangpura / Ashram Rd / C.G. Rd / Paldi / Naranpura) [50 Bins] ───────
    {"name": "Law Garden Night Market", "zone": "West Zone (Navrangpura)", "lat": 23.0232, "lng": 72.5574, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "C.G. Road Panchvati Circle", "zone": "West Zone (Navrangpura)", "lat": 23.0265, "lng": 72.5582, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "C.G. Road Swastik Cross", "zone": "West Zone (Navrangpura)", "lat": 23.0335, "lng": 72.5588, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Gujarat University Library", "zone": "West Zone (Navrangpura)", "lat": 23.0372, "lng": 72.5458, "capacity_liters": 360, "waste_type": WasteType.PAPER},
    {"name": "LD College of Engineering Campus", "zone": "West Zone (Navrangpura)", "lat": 23.0338, "lng": 72.5467, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Mithakhali Six Roads", "zone": "West Zone (Navrangpura)", "lat": 23.0278, "lng": 72.5620, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Ambawadi Circle West", "zone": "West Zone (Navrangpura)", "lat": 23.0215, "lng": 72.5510, "capacity_liters": 240, "waste_type": WasteType.METAL},
    {"name": "Sardar Patel Stadium Navrangpura", "zone": "West Zone (Navrangpura)", "lat": 23.0420, "lng": 72.5645, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Navrangpura Post Office Plaza", "zone": "West Zone (Navrangpura)", "lat": 23.0350, "lng": 72.5595, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Commerce Six Roads", "zone": "West Zone (Navrangpura)", "lat": 23.0385, "lng": 72.5520, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "St. Xavier's College Corner", "zone": "West Zone (Navrangpura)", "lat": 23.0310, "lng": 72.5535, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Ahmedabad Central Ambawadi", "zone": "West Zone (Navrangpura)", "lat": 23.0240, "lng": 72.5490, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Parimal Garden West Gate", "zone": "West Zone (Navrangpura)", "lat": 23.0185, "lng": 72.5560, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Paldi Cross Roads West", "zone": "West Zone (Navrangpura)", "lat": 23.0135, "lng": 72.5625, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Mahalaxmi Five Roads", "zone": "West Zone (Navrangpura)", "lat": 23.0110, "lng": 72.5600, "capacity_liters": 240, "waste_type": WasteType.PLASTIC},
    {"name": "Anjali Cross Roads", "zone": "West Zone (Navrangpura)", "lat": 23.0030, "lng": 72.5660, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "NID Campus Paldi", "zone": "West Zone (Navrangpura)", "lat": 23.0120, "lng": 72.5710, "capacity_liters": 360, "waste_type": WasteType.PAPER},
    {"name": "Sanskar Kendra Museum", "zone": "West Zone (Navrangpura)", "lat": 23.0105, "lng": 72.5700, "capacity_liters": 240, "waste_type": WasteType.OTHER},
    {"name": "Kochrab Ashram Heritage", "zone": "West Zone (Navrangpura)", "lat": 23.0080, "lng": 72.5680, "capacity_liters": 240, "waste_type": WasteType.ORGANIC},
    {"name": "Usmanpura Garden Circle", "zone": "West Zone (Navrangpura)", "lat": 23.0470, "lng": 72.5710, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Usmanpura Char Rasta", "zone": "West Zone (Navrangpura)", "lat": 23.0490, "lng": 72.5680, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Gujarat Vidyapith Campus", "zone": "West Zone (Navrangpura)", "lat": 23.0440, "lng": 72.5700, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Income Tax Circle Ashram Rd", "zone": "West Zone (Navrangpura)", "lat": 23.0410, "lng": 72.5720, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Mount Carmel Convent Corner", "zone": "West Zone (Navrangpura)", "lat": 23.0320, "lng": 72.5715, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Gandhi Bridge West Approach", "zone": "West Zone (Navrangpura)", "lat": 23.0360, "lng": 72.5730, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Nehru Bridge West Plaza", "zone": "West Zone (Navrangpura)", "lat": 23.0270, "lng": 72.5710, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Town Hall Ellis Bridge", "zone": "West Zone (Navrangpura)", "lat": 23.0210, "lng": 72.5695, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "VS Hospital Emergency Gate", "zone": "West Zone (Navrangpura)", "lat": 23.0160, "lng": 72.5705, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Naranpura Char Rasta", "zone": "West Zone (Navrangpura)", "lat": 23.0540, "lng": 72.5560, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "AEC Cross Roads Naranpura", "zone": "West Zone (Navrangpura)", "lat": 23.0610, "lng": 72.5510, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Sola Road Naranpura Circle", "zone": "West Zone (Navrangpura)", "lat": 23.0570, "lng": 72.5450, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Shastrinagar BRTS Station", "zone": "West Zone (Navrangpura)", "lat": 23.0650, "lng": 72.5520, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Ankur Char Rasta Naranpura", "zone": "West Zone (Navrangpura)", "lat": 23.0510, "lng": 72.5590, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Akhbarnagar Circle BRTS", "zone": "West Zone (Navrangpura)", "lat": 23.0680, "lng": 72.5650, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Pragati Nagar Naranpura", "zone": "West Zone (Navrangpura)", "lat": 23.0620, "lng": 72.5600, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Vyaswadi Vadaj Circle", "zone": "West Zone (Navrangpura)", "lat": 23.0720, "lng": 72.5710, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Vadaj Bus Terminus Hub", "zone": "West Zone (Navrangpura)", "lat": 23.0630, "lng": 72.5730, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Chandrabhaga Bridge West", "zone": "West Zone (Navrangpura)", "lat": 23.0780, "lng": 72.5780, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Dandi Kutir Approach Rd", "zone": "West Zone (Navrangpura)", "lat": 23.0590, "lng": 72.5740, "capacity_liters": 240, "waste_type": WasteType.OTHER},
    {"name": "Sabarmati Gandhi Ashram Plaza", "zone": "West Zone (Navrangpura)", "lat": 23.0605, "lng": 72.5800, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Subhash Bridge West Bank", "zone": "West Zone (Navrangpura)", "lat": 23.0650, "lng": 72.5810, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Ranip Cross Roads", "zone": "West Zone (Navrangpura)", "lat": 23.0750, "lng": 72.5830, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Ranip Central Bus Terminal", "zone": "West Zone (Navrangpura)", "lat": 23.0790, "lng": 72.5860, "capacity_liters": 1100, "waste_type": WasteType.OTHER},
    {"name": "Digambar Jain Temple Usmanpura", "zone": "West Zone (Navrangpura)", "lat": 23.0455, "lng": 72.5665, "capacity_liters": 240, "waste_type": WasteType.ORGANIC},
    {"name": "Gulbai Tekra Hollow Blocks", "zone": "West Zone (Navrangpura)", "lat": 23.0290, "lng": 72.5500, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Polytechnic Campus Gate", "zone": "West Zone (Navrangpura)", "lat": 23.0280, "lng": 72.5430, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "ATIRA Research Campus", "zone": "West Zone (Navrangpura)", "lat": 23.0310, "lng": 72.5370, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "AMA Management Assoc", "zone": "West Zone (Navrangpura)", "lat": 23.0285, "lng": 72.5350, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "IIM Old Campus Gate University", "zone": "West Zone (Navrangpura)", "lat": 23.0330, "lng": 72.5380, "capacity_liters": 360, "waste_type": WasteType.PAPER},
    {"name": "Panjrapole Cross Roads", "zone": "West Zone (Navrangpura)", "lat": 23.0270, "lng": 72.5410, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},

    # ── North West Zone (Bodakdev / Vastrapur / Thaltej / Sola / Science City / Gota) [50 Bins] ─
    {"name": "Science City Main Plaza", "zone": "North West Zone (Bodakdev)", "lat": 23.0785, "lng": 72.5020, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Science City Road Circle", "zone": "North West Zone (Bodakdev)", "lat": 23.0720, "lng": 72.5110, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Bodakdev Judges Bungalow Rd", "zone": "North West Zone (Bodakdev)", "lat": 23.0380, "lng": 72.5180, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Sindhu Bhavan Taj Skyline", "zone": "North West Zone (Bodakdev)", "lat": 23.0425, "lng": 72.5080, "capacity_liters": 480, "waste_type": WasteType.GLASS},
    {"name": "Alpha One Mall Vastrapur", "zone": "North West Zone (Bodakdev)", "lat": 23.0402, "lng": 72.5312, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Vastrapur Lake Garden East", "zone": "North West Zone (Bodakdev)", "lat": 23.0365, "lng": 72.5295, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "IIM Ahmedabad Main Gate", "zone": "North West Zone (Bodakdev)", "lat": 23.0315, "lng": 72.5328, "capacity_liters": 360, "waste_type": WasteType.PAPER},
    {"name": "S.G. Highway Bodakdev Junction", "zone": "North West Zone (Bodakdev)", "lat": 23.0470, "lng": 72.5190, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Thaltej Cross Roads SG Highway", "zone": "North West Zone (Bodakdev)", "lat": 23.0520, "lng": 72.5160, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Thaltej Shilaj Road Circle", "zone": "North West Zone (Bodakdev)", "lat": 23.0560, "lng": 72.5040, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Zydus Hospital Thaltej", "zone": "North West Zone (Bodakdev)", "lat": 23.0610, "lng": 72.5180, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Sola Civil Hospital Entrance", "zone": "North West Zone (Bodakdev)", "lat": 23.0740, "lng": 72.5270, "capacity_liters": 1100, "waste_type": WasteType.ORGANIC},
    {"name": "Sola Science City Overbridge", "zone": "North West Zone (Bodakdev)", "lat": 23.0770, "lng": 72.5190, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Sola Bhagwat Vidyapith", "zone": "North West Zone (Bodakdev)", "lat": 23.0810, "lng": 72.5250, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Gota Cross Roads SG Highway", "zone": "North West Zone (Bodakdev)", "lat": 23.0940, "lng": 72.5360, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Gota Vandemataram Road", "zone": "North West Zone (Bodakdev)", "lat": 23.1020, "lng": 72.5420, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Silver Oak University Campus", "zone": "North West Zone (Bodakdev)", "lat": 23.1070, "lng": 72.5480, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Gota Chandlodia Canal Rd", "zone": "North West Zone (Bodakdev)", "lat": 23.0910, "lng": 72.5490, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Chandlodia Railway Station", "zone": "North West Zone (Bodakdev)", "lat": 23.0820, "lng": 72.5530, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Ghatlodia Chankyapuri Bridge", "zone": "North West Zone (Bodakdev)", "lat": 23.0760, "lng": 72.5460, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Ghatlodia K.K. Nagar Circle", "zone": "North West Zone (Bodakdev)", "lat": 23.0690, "lng": 72.5430, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Ghatlodia R.C. Technical", "zone": "North West Zone (Bodakdev)", "lat": 23.0640, "lng": 72.5380, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Memnagar Gurukul Road", "zone": "North West Zone (Bodakdev)", "lat": 23.0530, "lng": 72.5340, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Nilmani Society Memnagar", "zone": "North West Zone (Bodakdev)", "lat": 23.0560, "lng": 72.5290, "capacity_liters": 240, "waste_type": WasteType.ORGANIC},
    {"name": "Drive-In Road Himalaya Mall", "zone": "North West Zone (Bodakdev)", "lat": 23.0510, "lng": 72.5240, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "SAL Hospital Thaltej Cross", "zone": "North West Zone (Bodakdev)", "lat": 23.0480, "lng": 72.5120, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "CIMS Hospital Science City Rd", "zone": "North West Zone (Bodakdev)", "lat": 23.0700, "lng": 72.5140, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Sindhu Bhavan Gotila Garden", "zone": "North West Zone (Bodakdev)", "lat": 23.0390, "lng": 72.4980, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Sindhu Bhavan Time Square", "zone": "North West Zone (Bodakdev)", "lat": 23.0410, "lng": 72.5020, "capacity_liters": 480, "waste_type": WasteType.GLASS},
    {"name": "Bopal Ambli BRTS Approach", "zone": "North West Zone (Bodakdev)", "lat": 23.0360, "lng": 72.4890, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Ambli Village Road Junction", "zone": "North West Zone (Bodakdev)", "lat": 23.0320, "lng": 72.4930, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Iscon Mega Mall S.G. Highway", "zone": "North West Zone (Bodakdev)", "lat": 23.0290, "lng": 72.5060, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Acropolis Mall Thaltej", "zone": "North West Zone (Bodakdev)", "lat": 23.0500, "lng": 72.5280, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Vastrapur Railway Station West", "zone": "North West Zone (Bodakdev)", "lat": 23.0300, "lng": 72.5200, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Sandesh Press Road Bodakdev", "zone": "North West Zone (Bodakdev)", "lat": 23.0450, "lng": 72.5260, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Sterling Hospital Memnagar", "zone": "North West Zone (Bodakdev)", "lat": 23.0550, "lng": 72.5360, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Sun-n-Step Club Sola", "zone": "North West Zone (Bodakdev)", "lat": 23.0650, "lng": 72.5330, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Sattadhar Cross Roads Sola", "zone": "North West Zone (Bodakdev)", "lat": 23.0710, "lng": 72.5360, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Gujarat High Court SG Highway", "zone": "North West Zone (Bodakdev)", "lat": 23.0800, "lng": 72.5290, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Nirma University Outer Gate", "zone": "North West Zone (Bodakdev)", "lat": 23.1250, "lng": 72.5450, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Vaishno Devi Circle North West", "zone": "North West Zone (Bodakdev)", "lat": 23.1180, "lng": 72.5380, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Ognaj Circle Ring Road", "zone": "North West Zone (Bodakdev)", "lat": 23.0890, "lng": 72.4920, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Shilaj Cross Road SP Ring", "zone": "North West Zone (Bodakdev)", "lat": 23.0620, "lng": 72.4820, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Science City Planet Earth Hall", "zone": "North West Zone (Bodakdev)", "lat": 23.0810, "lng": 72.5010, "capacity_liters": 240, "waste_type": WasteType.PLASTIC},
    {"name": "Science City Robotics Gallery", "zone": "North West Zone (Bodakdev)", "lat": 23.0760, "lng": 72.5050, "capacity_liters": 240, "waste_type": WasteType.METAL},
    {"name": "Vastrapur Amphitheatre Gate", "zone": "North West Zone (Bodakdev)", "lat": 23.0350, "lng": 72.5280, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Premchandnagar Road Satellite", "zone": "North West Zone (Bodakdev)", "lat": 23.0340, "lng": 72.5220, "capacity_liters": 240, "waste_type": WasteType.PLASTIC},
    {"name": "Goyal Intercity Drive-In", "zone": "North West Zone (Bodakdev)", "lat": 23.0535, "lng": 72.5215, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Surdhara Circle Thaltej", "zone": "North West Zone (Bodakdev)", "lat": 23.0570, "lng": 72.5210, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Bhadaj Circle Extension", "zone": "North West Zone (Bodakdev)", "lat": 23.0900, "lng": 72.5050, "capacity_liters": 480, "waste_type": WasteType.OTHER},

    # ── South West Zone (Satellite / Prahlad Nagar / Jodhpur / Vejalpur / Sarkhej) [50 Bins] ─
    {"name": "Prahlad Nagar Garden East", "zone": "South West Zone (Satellite)", "lat": 23.0125, "lng": 72.5080, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Prahlad Nagar Corporate Road", "zone": "South West Zone (Satellite)", "lat": 23.0105, "lng": 72.5045, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Satellite Shivranjani Cross", "zone": "South West Zone (Satellite)", "lat": 23.0210, "lng": 72.5320, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Jodhpur Gam Cross Road", "zone": "South West Zone (Satellite)", "lat": 23.0180, "lng": 72.5230, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Shyamal Cross Road BRTS", "zone": "South West Zone (Satellite)", "lat": 23.0135, "lng": 72.5285, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Sarkhej Roza Heritage Plaza", "zone": "South West Zone (Satellite)", "lat": 22.9805, "lng": 72.5025, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Sarkhej Highway Sanand Circle", "zone": "South West Zone (Satellite)", "lat": 22.9860, "lng": 72.5090, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Vejalpur APMC Market Sub-Yard", "zone": "South West Zone (Satellite)", "lat": 23.0035, "lng": 72.5210, "capacity_liters": 1100, "waste_type": WasteType.ORGANIC},
    {"name": "Jodhpur Star Bazaar Junction", "zone": "South West Zone (Satellite)", "lat": 23.0250, "lng": 72.5260, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "ISKCON Cross Road SG Highway", "zone": "South West Zone (Satellite)", "lat": 23.0275, "lng": 72.5075, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Ramdevnagar ISKCON Road", "zone": "South West Zone (Satellite)", "lat": 23.0260, "lng": 72.5180, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Seema Hall Anandnagar Rd", "zone": "South West Zone (Satellite)", "lat": 23.0160, "lng": 72.5160, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Anandnagar 100ft Main Road", "zone": "South West Zone (Satellite)", "lat": 23.0140, "lng": 72.5120, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Sachin Tower Anandnagar", "zone": "South West Zone (Satellite)", "lat": 23.0120, "lng": 72.5150, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Titanium City Center Anandnagar", "zone": "South West Zone (Satellite)", "lat": 23.0145, "lng": 72.5235, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Venus Atlantis Corporate Park", "zone": "South West Zone (Satellite)", "lat": 23.0115, "lng": 72.5095, "capacity_liters": 480, "waste_type": WasteType.GLASS},
    {"name": "Pinnacle Business Park Prahladnagar", "zone": "South West Zone (Satellite)", "lat": 23.0085, "lng": 72.5070, "capacity_liters": 360, "waste_type": WasteType.METAL},
    {"name": "YMCA Club SG Highway", "zone": "South West Zone (Satellite)", "lat": 23.0040, "lng": 72.5020, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Makarba Railway Crossing", "zone": "South West Zone (Satellite)", "lat": 22.9960, "lng": 72.5050, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Makarba Corporate Road", "zone": "South West Zone (Satellite)", "lat": 22.9920, "lng": 72.5010, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Sarkhej Police Station Square", "zone": "South West Zone (Satellite)", "lat": 22.9850, "lng": 72.4990, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Sarkhej Ujala Circle", "zone": "South West Zone (Satellite)", "lat": 22.9780, "lng": 72.4950, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Fatehwadi Sarkhej Canal", "zone": "South West Zone (Satellite)", "lat": 22.9730, "lng": 72.5080, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Vejalpur Butbhavani Temple", "zone": "South West Zone (Satellite)", "lat": 23.0010, "lng": 72.5270, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Vejalpur Srinand Nagar", "zone": "South West Zone (Satellite)", "lat": 22.9980, "lng": 72.5230, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Jivraj Park Cross Roads", "zone": "South West Zone (Satellite)", "lat": 23.0015, "lng": 72.5380, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Malav Talav Jivraj Park", "zone": "South West Zone (Satellite)", "lat": 23.0050, "lng": 72.5410, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Vasna Barrage Road", "zone": "South West Zone (Satellite)", "lat": 22.9960, "lng": 72.5520, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Vasna Bus Terminus", "zone": "South West Zone (Satellite)", "lat": 23.0020, "lng": 72.5550, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Anjali Cinema Vasna Circle", "zone": "South West Zone (Satellite)", "lat": 23.0060, "lng": 72.5610, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Shreyas Railway Crossing", "zone": "South West Zone (Satellite)", "lat": 23.0120, "lng": 72.5480, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Manekbaug Hall Satellite", "zone": "South West Zone (Satellite)", "lat": 23.0180, "lng": 72.5420, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Nehru Nagar Circle Satellite", "zone": "South West Zone (Satellite)", "lat": 23.0230, "lng": 72.5425, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Jhansi Ki Rani Statue Square", "zone": "South West Zone (Satellite)", "lat": 23.0225, "lng": 72.5355, "capacity_liters": 360, "waste_type": WasteType.METAL},
    {"name": "Bopal Ring Road Junction", "zone": "South West Zone (Satellite)", "lat": 23.0310, "lng": 72.4710, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "South Bopal Gala Gymkhana Rd", "zone": "South West Zone (Satellite)", "lat": 23.0220, "lng": 72.4760, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "South Bopal Commercial Plaza", "zone": "South West Zone (Satellite)", "lat": 23.0180, "lng": 72.4720, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Mumatpura Cross Road", "zone": "South West Zone (Satellite)", "lat": 23.0050, "lng": 72.4850, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Ambli Bopal Overbridge South", "zone": "South West Zone (Satellite)", "lat": 23.0330, "lng": 72.4790, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Crowne Plaza City Centre SG", "zone": "South West Zone (Satellite)", "lat": 23.0150, "lng": 72.5060, "capacity_liters": 480, "waste_type": WasteType.GLASS},
    {"name": "Dev Arc Mall SG Highway", "zone": "South West Zone (Satellite)", "lat": 23.0280, "lng": 72.5090, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Wide Angle Multiplex SG Hwy", "zone": "South West Zone (Satellite)", "lat": 23.0230, "lng": 72.5050, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Rajpath Club SG Highway", "zone": "South West Zone (Satellite)", "lat": 23.0370, "lng": 72.5110, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Prahlad Nagar Fire Station", "zone": "South West Zone (Satellite)", "lat": 23.0090, "lng": 72.5055, "capacity_liters": 240, "waste_type": WasteType.OTHER},
    {"name": "Vejalpur Shivalik Plaza", "zone": "South West Zone (Satellite)", "lat": 23.0080, "lng": 72.5210, "capacity_liters": 360, "waste_type": WasteType.PAPER},
    {"name": "Vishala Circle Vasna", "zone": "South West Zone (Satellite)", "lat": 22.9910, "lng": 72.5590, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Gyaspur Depot BRTS Terminal", "zone": "South West Zone (Satellite)", "lat": 22.9820, "lng": 72.5620, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Guptanagar Vasna Market", "zone": "South West Zone (Satellite)", "lat": 22.9980, "lng": 72.5480, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Satellite Bimanagar Road", "zone": "South West Zone (Satellite)", "lat": 23.0240, "lng": 72.5310, "capacity_liters": 240, "waste_type": WasteType.PLASTIC},
    {"name": "Jodhpur Tekra Hill Top", "zone": "South West Zone (Satellite)", "lat": 23.0200, "lng": 72.5270, "capacity_liters": 240, "waste_type": WasteType.OTHER},

    # ── Central Zone (Old City / Khadia / Kalupur / Bhadra / Teen Darwaja / Manek Chowk) [50 Bins] ──
    {"name": "Sabarmati Riverfront Vallabh Sadan", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0335, "lng": 72.5695, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Sabarmati Riverfront Event Centre", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0220, "lng": 72.5718, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Ellis Bridge Victoria Garden", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0210, "lng": 72.5730, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Nehru Bridge Lal Darwaja", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0280, "lng": 72.5720, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Sidi Saiyyed Mosque Plaza", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0275, "lng": 72.5785, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Bhadra Fort Teen Darwaja", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0245, "lng": 72.5780, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Manek Chowk Gold Bazaar", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0220, "lng": 72.5870, "capacity_liters": 2400, "waste_type": WasteType.ORGANIC},  # #1 Commercial Hotspot
    {"name": "Kalupur Railway Terminal", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0265, "lng": 72.5990, "capacity_liters": 1100, "waste_type": WasteType.PLASTIC},
    {"name": "Lal Darwaja AMTS Bus Terminus", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0250, "lng": 72.5740, "capacity_liters": 1100, "waste_type": WasteType.PLASTIC},
    {"name": "Sardar Patel Bhawan AMC HQ", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0290, "lng": 72.5735, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Apna Bazaar Lal Darwaja", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0260, "lng": 72.5760, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Premabhai Hall Bhadra", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0255, "lng": 72.5790, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Karanj Police Station Square", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0268, "lng": 72.5810, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Jama Masjid Heritage Plaza", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0235, "lng": 72.5860, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Rani no Hajiro Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0228, "lng": 72.5880, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Badshah no Hajiro Tomb", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0232, "lng": 72.5875, "capacity_liters": 240, "waste_type": WasteType.ORGANIC},
    {"name": "Ratanpol Cloth Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0250, "lng": 72.5890, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Gandhi Road Cross Basin", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0240, "lng": 72.5840, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Relief Road Electric Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0270, "lng": 72.5880, "capacity_liters": 480, "waste_type": WasteType.METAL},
    {"name": "Relief Road Zaveri Vad", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0280, "lng": 72.5910, "capacity_liters": 360, "waste_type": WasteType.GLASS},
    {"name": "Kalupur Fruit Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0255, "lng": 72.5960, "capacity_liters": 1100, "waste_type": WasteType.ORGANIC},
    {"name": "Kalupur Swaminarayan Mandir", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0305, "lng": 72.5950, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Dariyapur Gate Heritage", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0360, "lng": 72.5940, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Delhi Gate Old City", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0370, "lng": 72.5860, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Shahpur Gate River View", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0390, "lng": 72.5780, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Shahpur Bahai Centre", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0350, "lng": 72.5760, "capacity_liters": 240, "waste_type": WasteType.PAPER},
    {"name": "Khanpur Riverfront Promenade", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0310, "lng": 72.5730, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Gaekwad Haveli Old Fort", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0170, "lng": 72.5760, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Jamalpur Flower Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0130, "lng": 72.5770, "capacity_liters": 1100, "waste_type": WasteType.ORGANIC},
    {"name": "Jamalpur APMC Fish Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0110, "lng": 72.5780, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Jagannath Temple Jamalpur", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0125, "lng": 72.5820, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Sardar Bridge East Ramp", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0160, "lng": 72.5740, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Calico Dome Relief Road", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0275, "lng": 72.5850, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Pankore Naka Old Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0258, "lng": 72.5865, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Astodia Darwaja Historic", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0190, "lng": 72.5920, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Raipur Darwaja Bhajia House", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0180, "lng": 72.5970, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Sarangpur Darwaja Sweets", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0220, "lng": 72.6020, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Sarangpur Water Tank Post", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0210, "lng": 72.6040, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Panchkuva Cloth Market", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0240, "lng": 72.6030, "capacity_liters": 480, "waste_type": WasteType.PAPER},
    {"name": "Prem Darwaja Railway Colony", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0340, "lng": 72.6010, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Hutheesing Jain Temple", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0450, "lng": 72.5930, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Camp Hanuman Cantonment Gate", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0580, "lng": 72.6020, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Shahibaug Underbridge Circle", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0510, "lng": 72.5960, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Civil Hospital Asarwa Gate", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0480, "lng": 72.6070, "capacity_liters": 1100, "waste_type": WasteType.OTHER},
    {"name": "Asarwa Lake Historic Kund", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0420, "lng": 72.6080, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Dada Harir Stepwell", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0400, "lng": 72.6050, "capacity_liters": 240, "waste_type": WasteType.OTHER},
    {"name": "Idgah Circle Asarwa", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0370, "lng": 72.6040, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Riverfront Biodiversity Park", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0190, "lng": 72.5720, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Riverfront Sports Enclave", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0250, "lng": 72.5710, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Ambedkar Bridge East Ramp", "zone": "Central Zone (Khadia/Riverfront)", "lat": 23.0030, "lng": 72.5750, "capacity_liters": 480, "waste_type": WasteType.OTHER},

    # ── East Zone (Bapunagar / Nikol / Maninagar / Kankaria / Amraiwadi / Odhav) [50 Bins] ───
    {"name": "Kankaria Lake Gate 1", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0065, "lng": 72.5995, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Kankaria Lake Balvatika", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9985, "lng": 72.6020, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Maninagar Railway Station", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9980, "lng": 72.6105, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Gita Mandir Central Bus Port", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0135, "lng": 72.5875, "capacity_liters": 1100, "waste_type": WasteType.PLASTIC},
    {"name": "Bapunagar Diamond Market", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0425, "lng": 72.6280, "capacity_liters": 480, "waste_type": WasteType.METAL},
    {"name": "Bapunagar Industrial Estate", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0480, "lng": 72.6340, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Nikol Lake Garden", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0520, "lng": 72.6510, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Nikol Gam Ring Road Circle", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0450, "lng": 72.6480, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Kankaria Zoo Main Gate", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0040, "lng": 72.6030, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Nagina Wadi Island Kankaria", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0055, "lng": 72.6025, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Kankaria Football Ground", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0090, "lng": 72.6010, "capacity_liters": 360, "waste_type": WasteType.PLASTIC},
    {"name": "Maninagar Char Rasta", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0010, "lng": 72.6080, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Rambaug Hospital Maninagar", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0030, "lng": 72.6050, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Jawahar Chowk Maninagar", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9950, "lng": 72.6070, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Pushpakunj Circle Kankaria", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9990, "lng": 72.5970, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Danilimda Cross Road", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9920, "lng": 72.5860, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Chandola Lake North Embankment", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9850, "lng": 72.5910, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Shah Alam Darwaja Roza", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9970, "lng": 72.5910, "capacity_liters": 360, "waste_type": WasteType.ORGANIC},
    {"name": "Isanpur Cross Roads", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9810, "lng": 72.6030, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Isanpur Govindwadi BRTS", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9770, "lng": 72.6060, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Ghodasar Canal Cross Road", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9820, "lng": 72.6160, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Cadila Bridge Ghodasar", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9850, "lng": 72.6120, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "Jasodanagar Cross Road", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9880, "lng": 72.6280, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Vatva GIDC Phase 1 Entry", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9680, "lng": 72.6310, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Vatva Railway Station East", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9610, "lng": 72.6250, "capacity_liters": 480, "waste_type": WasteType.OTHER},
    {"name": "CTM Cross Road Express Highway", "zone": "East Zone (Bapunagar/Nikol)", "lat": 22.9960, "lng": 72.6320, "capacity_liters": 1100, "waste_type": WasteType.PLASTIC},
    {"name": "Amraiwadi Metro Station", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0080, "lng": 72.6250, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Rabari Colony BRTS Junction", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0040, "lng": 72.6350, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Surelia Estate Amraiwadi", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0130, "lng": 72.6310, "capacity_liters": 480, "waste_type": WasteType.METAL},
    {"name": "Hatkeshwar Circle Khokhra", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0010, "lng": 72.6180, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Anupam Cinema Khokhra", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0050, "lng": 72.6150, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "Rohit Mills Khokhra Road", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0090, "lng": 72.6140, "capacity_liters": 360, "waste_type": WasteType.PAPER},
    {"name": "Gomtipur Underbridge Market", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0190, "lng": 72.6160, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Rakhiyal Cross Roads", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0240, "lng": 72.6230, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Ajit Mill Char Rasta", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0290, "lng": 72.6310, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Soni ni Chali BRTS Junction", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0280, "lng": 72.6410, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Odhav GIDC Fire Station", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0290, "lng": 72.6580, "capacity_liters": 660, "waste_type": WasteType.METAL},
    {"name": "Odhav Ring Road Circle", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0310, "lng": 72.6710, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Viratnagar Cross Road", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0370, "lng": 72.6430, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Bapunagar General Hospital", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0450, "lng": 72.6310, "capacity_liters": 360, "waste_type": WasteType.OTHER},
    {"name": "India Colony Road Bapunagar", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0490, "lng": 72.6390, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Thakkarbapanagar Approach", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0530, "lng": 72.6420, "capacity_liters": 660, "waste_type": WasteType.ORGANIC},
    {"name": "Nikol Raspan Arcade", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0490, "lng": 72.6590, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Nikol D-Mart Cross Road", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0550, "lng": 72.6630, "capacity_liters": 660, "waste_type": WasteType.PLASTIC},
    {"name": "Naroda Patiya Junction", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0640, "lng": 72.6450, "capacity_liters": 660, "waste_type": WasteType.OTHER},
    {"name": "Naroda Fruit Market Yard", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0680, "lng": 72.6520, "capacity_liters": 1100, "waste_type": WasteType.ORGANIC},
    {"name": "Naroda Bethak Bazar", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0720, "lng": 72.6560, "capacity_liters": 480, "waste_type": WasteType.ORGANIC},
    {"name": "Naroda GIDC Phase 3", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0790, "lng": 72.6680, "capacity_liters": 660, "waste_type": WasteType.METAL},
    {"name": "Krishnanagar Cross Roads", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0590, "lng": 72.6380, "capacity_liters": 480, "waste_type": WasteType.PLASTIC},
    {"name": "Memco Cross Roads Naroda Rd", "zone": "East Zone (Bapunagar/Nikol)", "lat": 23.0480, "lng": 72.6170, "capacity_liters": 660, "waste_type": WasteType.OTHER},
]


def generate_bins(db: Session) -> list[Bin]:
    """Create 250 bins at authentic, verified Ahmedabad landmark locations."""
    bins = []
    for data in AHMEDABAD_LANDMARK_BINS:
        bin_obj = Bin(
            name=data["name"],
            lat=round(data["lat"], 6),
            lng=round(data["lng"], 6),
            capacity_liters=data["capacity_liters"],
            waste_type=data["waste_type"],
            zone=data["zone"],
            current_fill_percent=0.0,
        )
        db.add(bin_obj)
        bins.append(bin_obj)

    db.flush()
    return bins


def sync_accurate_landmark_bins(db: Session) -> list[Bin]:
    """
    Synchronizes existing database bins so their names, zones, and coordinates
    accurately reflect authentic Ahmedabad landmarks.
    """
    existing_bins = db.query(Bin).order_by(Bin.id).all()
    if not existing_bins:
        return generate_bins(db)

    for i, bin_obj in enumerate(existing_bins):
        if i < len(AHMEDABAD_LANDMARK_BINS):
            data = AHMEDABAD_LANDMARK_BINS[i]
            bin_obj.name = data["name"]
            bin_obj.zone = data["zone"]
            bin_obj.lat = round(data["lat"], 6)
            bin_obj.lng = round(data["lng"], 6)
            bin_obj.capacity_liters = data["capacity_liters"]
            bin_obj.waste_type = data["waste_type"]

    db.commit()
    return existing_bins


def generate_fill_readings(db: Session, bins: list[Bin], days: int = 20):
    """
    Backfill hourly fill readings across 20 days using bulk SQL inserts:
    Fill rises with diurnal noise, resets at periodic collection events.
    """
    now = datetime.datetime.utcnow()
    start = now - datetime.timedelta(days=days)
    readings_batch = []

    for idx, bin_obj in enumerate(bins):
        fill = random.uniform(5, 15)  # Start fill
        name_lower = bin_obj.name.lower()

        # Authentic Ahmedabad waste hierarchy: Wholesale markets & transit lead
        if "manek chowk" in name_lower:
            daily_rate = random.uniform(50.0, 56.0)  # #1 Waste Hotspot (Food & Night Bazaar)
            collection_interval_hours = 30
            target_final_fill = random.uniform(93.0, 97.0)
        elif "kalupur" in name_lower and ("railway" in name_lower or "fruit" in name_lower):
            daily_rate = random.uniform(44.0, 48.0)  # Major Transit & Wholesale Market
            collection_interval_hours = 36
            target_final_fill = random.uniform(88.0, 94.0)
        elif "apmc" in name_lower:
            daily_rate = random.uniform(39.0, 43.0)  # Agricultural Market Committee
            collection_interval_hours = 42
            target_final_fill = random.uniform(84.0, 91.0)
        elif "gita mandir" in name_lower:
            daily_rate = random.uniform(34.0, 38.0)  # Central Bus Terminal
            collection_interval_hours = 48
            target_final_fill = random.uniform(80.0, 87.0)
        elif "alpha one" in name_lower:
            daily_rate = random.uniform(29.0, 33.0)  # Vastrapur Mega Mall
            collection_interval_hours = 48
            target_final_fill = random.uniform(76.0, 83.0)
        elif "bapunagar industrial" in name_lower or "naroda fruit" in name_lower:
            daily_rate = random.uniform(25.0, 30.0)  # Dense Manufacturing / Wholesale
            collection_interval_hours = 54
            target_final_fill = random.uniform(72.0, 80.0)
        elif idx % 15 == 0:
            daily_rate = random.uniform(22.0, 26.0)  # Busy commercial junctions
            collection_interval_hours = 60
            target_final_fill = random.uniform(78.0, 86.0)
        elif idx % 8 == 0:
            daily_rate = random.uniform(16.0, 20.0)  # Transit nodes & colleges
            collection_interval_hours = 72
            target_final_fill = random.uniform(62.0, 72.0)
        elif idx % 3 == 0:
            daily_rate = random.uniform(10.0, 15.0)  # Medium density residential/market
            collection_interval_hours = random.randint(4, 7) * 24
            target_final_fill = random.uniform(45.0, 60.0)
        else:
            daily_rate = random.uniform(5.0, 10.0)  # Standard residential bins
            collection_interval_hours = random.randint(5, 8) * 24
            target_final_fill = random.uniform(18.0, 48.0)

        hourly_rate = daily_rate / 24.0
        hours_since_collection = 0

        current_time = start
        while current_time <= now:
            noise = random.gauss(0, 0.3)
            fill += hourly_rate + noise
            fill = max(0.0, min(fill, 100.0))
            hours_since_collection += 1

            # Last 36 hours: smoothly guide toward target final fill
            hours_remaining = (now - current_time).total_seconds() / 3600.0
            if hours_remaining <= 36:
                fill += (target_final_fill - fill) * 0.08
            else:
                if hours_since_collection >= collection_interval_hours and fill > 50:
                    fill = random.uniform(2, 10)
                    hours_since_collection = 0

            readings_batch.append({
                "bin_id": bin_obj.id,
                "timestamp": current_time,
                "fill_percent": round(fill, 2),
            })

            current_time += datetime.timedelta(hours=1)

        # Set current fill to the latest reading
        bin_obj.current_fill_percent = round(fill, 2)

        # High-performance bulk insert every 10,000 readings
        if len(readings_batch) >= 10000:
            db.bulk_insert_mappings(FillReading, readings_batch)
            readings_batch = []

    if readings_batch:
        db.bulk_insert_mappings(FillReading, readings_batch)

    db.flush()


def generate_vehicles(db: Session) -> list[Vehicle]:
    """Create 4 AMC collection vehicles with depots covering the city."""
    vehicles = []
    depot_positions = [
        (CENTER_LAT + 0.012, CENTER_LNG - 0.015),  # West Depot (Ashram Road / Navrangpura)
        (CENTER_LAT - 0.020, CENTER_LNG + 0.025),  # South Depot (Kankaria / Danilimda)
        (CENTER_LAT + 0.025, CENTER_LNG - 0.035),  # North-West Depot (Bodakdev / SG Highway)
        (CENTER_LAT - 0.010, CENTER_LNG + 0.035),  # East Depot (Maninagar / Nikol)
    ]
    names = [
        "AMC Swachhata Vahini 01",
        "AMC Swachhata Vahini 02",
        "AMC Swachhata Vahini 03",
        "AMC Swachhata Vahini 04",
    ]

    for i, (dlat, dlng) in enumerate(depot_positions):
        vehicle = Vehicle(
            name=names[i],
            capacity_liters=25000.0,  # Scaled for 250-node municipal coverage
            depot_lat=round(dlat, 6),
            depot_lng=round(dlng, 6),
            current_lat=round(dlat, 6),
            current_lng=round(dlng, 6),
            is_active=True,
        )
        db.add(vehicle)
        vehicles.append(vehicle)

    db.flush()
    return vehicles


def generate_initial_alerts(db: Session, bins: list[Bin]):
    """Create alerts for bins, with a high-priority Special Alert for Manek Chowk."""
    for bin_obj in bins:
        is_top = "manek chowk" in bin_obj.name.lower()
        if is_top:
            alert = Alert(
                bin_id=bin_obj.id,
                zone=bin_obj.zone,
                alert_type="special_producer",
                message=f"🚨 [SPECIAL ALERT · #1 WASTE PRODUCER] Manek Chowk Food & Night Bazaar is Ahmedabad's highest volume waste generator ({bin_obj.current_fill_percent:.0f}% fill). High-capacity compactor allocated!",
                severity="critical",
                is_active=True,
            )
            db.add(alert)
        elif bin_obj.current_fill_percent >= 85.0:
            alert = Alert(
                bin_id=bin_obj.id,
                zone=bin_obj.zone,
                alert_type="threshold",
                message=f"{bin_obj.name} is at {bin_obj.current_fill_percent:.0f}% capacity — collection needed urgently!",
                severity="critical",
                is_active=True,
            )
            db.add(alert)
        elif bin_obj.current_fill_percent >= 70.0:
            alert = Alert(
                bin_id=bin_obj.id,
                zone=bin_obj.zone,
                alert_type="threshold",
                message=f"{bin_obj.name} is at {bin_obj.current_fill_percent:.0f}% capacity — schedule collection soon.",
                severity="warning",
                is_active=True,
            )
            db.add(alert)

    db.flush()


def seed_database(db: Session):
    """Main entry point: generate all synthetic data for 250 bins."""
    print("[Seeder] Generating 250 bins across 5 AMC zones...")
    bins = generate_bins(db)
    print(f"[Seeder] Created {len(bins)} bins")

    print("[Seeder] Generating fill readings (20 days) via bulk insert...")
    generate_fill_readings(db, bins, days=20)
    print("[Seeder] Fill readings generated successfully")

    print("[Seeder] Generating vehicles...")
    vehicles = generate_vehicles(db)
    print(f"[Seeder] Created {len(vehicles)} vehicles")

    print("[Seeder] Generating initial alerts...")
    generate_initial_alerts(db, bins)

    db.commit()
    print("[Seeder] Database seeded with 250 bins successfully!")
