/* Local preview only.
   index.html loads this on localhost / 127.0.0.1 / ::1 and never initialises Firebase.
   Production does not request this file. Firebase Hosting ignores dev/.
   cv is a read-only snapshot of the live public/cv document, for layout review only.
   portfolio is example data for the owner-only list. It is not the public Research page.
   Nothing here is written back to Firestore. */
window.MOCK_DATA = {
  cv: {
  "tagline": "Economist · Researcher & Data Analyst",
  "experience": [
    {
      "description": "Analysed high-dimensional datasets from medieval manuscript fragments; cleaned and structured spectral data for clustering and similarity analysis, and built reproducible R/Python pipelines.",
      "role": "Research Assistant",
      "company": "University of Helsinki — Faculty of Theology",
      "period": "Feb 2026 – Apr 2026"
    },
    {
      "description": "Analysed structured historical datasets using database methods and classification/similarity metrics; supported digital cataloguing and metadata standardisation.",
      "period": "Sep 2025 – Dec 2025",
      "company": "University of Helsinki — Faculty of Theology",
      "role": "Research Trainee"
    },
    {
      "company": "Strathmore University, Nairobi",
      "role": "Administrator – Student Mentoring Services",
      "period": "Apr 2022 – Mar 2023",
      "description": "Coordinated mentoring programmes for 1,000+ students; designed tracking systems and produced analytical reports for evidence-based improvements."
    },
    {
      "company": "Strathmore Educational Trust – Eastlands Project",
      "period": "Jan 2021 – Feb 2022",
      "description": "Supported proposal development, budgeting, monitoring and reporting; built dashboards and reporting frameworks and coordinated with international partners and funders.",
      "role": "Assistant Project Manager"
    },
    {
      "period": "May 2020 – Jan 2021",
      "description": "Supported econometric and statistical research; cleaned, structured and analysed data in R and Stata and contributed to empirical modelling and technical reports.",
      "role": "Research Assistant",
      "company": "Strathmore Data Analytics Centre, Nairobi"
    },
    {
      "description": "Continued with the research data work on the CHARM project.",
      "role": "Research Assistant (CHARM Project)",
      "company": "University of Helsinki — Faculty of Theology",
      "period": "Aug 2026 – present"
    }
  ],
  "education": [
    {
      "degree": "Research Master's in Economics",
      "period": "Aug 2024 – May 2026",
      "school": "University of Helsinki, Finland"
    },
    {
      "degree": "BBSc in Financial Economics",
      "period": "Jul 2016 – Dec 2020",
      "school": "Strathmore University, Nairobi"
    }
  ],
  "languages": [
    {
      "level": "Mother tongue",
      "name": "Luo"
    },
    {
      "level": "C2 — full professional & academic",
      "name": "English"
    },
    {
      "name": "Swahili",
      "level": "C2 — native / full professional"
    },
    {
      "level": "A2 — basic (improving)",
      "name": "Finnish"
    }
  ],
  "skills": [
    "R",
    "Stata",
    "Python",
    "Econometrics",
    "Time series (GARCH, ARIMA)",
    "Data cleaning",
    "Reproducible workflows",
    "Git / GitHub",
    "MySQL",
    "Excel / MS Office",
    "Impact evaluation",
    "Technical reporting",
    "Project coordination"
  ],
  "certifications": [
    {
      "issuer": "NIERA",
      "name": "Impact Evaluation Training for Researchers in East Africa",
      "date": "Mar 2022"
    },
    {
      "issuer": "Cisco Networking Academy & Python Institute",
      "date": "Jan 2024",
      "name": "Python Essentials 1"
    },
    {
      "date": "Jan 2024",
      "name": "Data Analytics Essentials",
      "issuer": "Cisco Networking Academy"
    },
    {
      "date": "Dec 2023",
      "name": "Introduction to Data Science",
      "issuer": "Cisco Networking Academy"
    }
  ],
  "recommendations": [
    {
      "link": "",
      "detail": "Recommendation letter, January 2026",
      "title": "University of Helsinki, Faculty of Theology — Research Trainee (CHARM Project)"
    },
    {
      "detail": "Certificate of Service, Apr 2022 – Mar 2023",
      "title": "Strathmore University — Administrator, Student Mentoring Services",
      "link": ""
    },
    {
      "link": "",
      "detail": "Recommendation letter, Jan 2021 – Feb 2022",
      "title": "Strathmore Educational Trust — Assistant Project Manager"
    }
  ],
  "summary": "I'm an economist and data analyst in Helsinki. I completed the Research Track of the Master's Programme in Economics at the University of Helsinki in May 2026. My thesis, supervised by Professor Mika Meitz, compared GARCH-family models with Random Forest regression for forecasting Bitcoin volatility, and tested whether Google Trends search interest adds predictive power. It largely doesn't: a Gaussian GARCH(1,1) was the benchmark that no competitor significantly beat.\n\nMost of my recent work has been hands-on data work on CHARM, a University of Helsinki Faculty of Theology project on Finland's oldest written culture. I joined the project as a Research Trainee in autumn 2025. As a Research Assistant from February to April 2026, I cleaned and structured high-dimensional spectral data from medieval manuscript fragments and built reproducible R and Python pipelines for clustering and similarity analysis. I have been a Research Assistant on CHARM again since August 2026. Before moving to Finland I did empirical research support at the Strathmore Data Analytics Centre in Nairobi, and project and programme coordination at Strathmore University and the Strathmore Educational Trust.\n\nI work in R, Stata and Python, and I'm most interested in labour markets, remittances, and the Finnish economy."
},
  portfolio: [
    {"title":"Example repo 01","desc":"Example data, not a real project.","link":"https://example.com/repo-01","status":"Example"},
    {"title":"Example repo 02","desc":"Example data, not a real project.","link":"https://example.com/repo-02","status":"Example"},
    {"title":"Example repo 03","desc":"Example data, not a real project.","link":"https://example.com/repo-03","status":"Example"},
    {"title":"Example repo 04","desc":"Example data, not a real project.","link":"https://example.com/repo-04","status":"Example"},
    {"title":"Example repo 05","desc":"Example data, not a real project.","link":"https://example.com/repo-05","status":"Example"},
    {"title":"Example repo 06","desc":"Example data, not a real project.","link":"https://example.com/repo-06","status":"Example"},
    {"title":"Example repo 07","desc":"Example data, not a real project.","link":"https://example.com/repo-07","status":"Example"},
    {"title":"Example repo 08","desc":"Example data, not a real project.","link":"https://example.com/repo-08","status":"Example"},
    {"title":"Example repo 09","desc":"Example data, not a real project.","link":"https://example.com/repo-09","status":"Example"},
    {"title":"Example repo 10","desc":"Example data, not a real project.","link":"https://example.com/repo-10","status":"Example"},
    {"title":"Example repo 11","desc":"Example data, not a real project.","link":"https://example.com/repo-11","status":"Example"},
    {"title":"Example repo 12","desc":"Example data, not a real project.","link":"https://example.com/repo-12","status":"Example"},
    {"title":"Example repo 13","desc":"Example data, not a real project.","link":"https://example.com/repo-13","status":"Example"},
    {"title":"Example repo 14","desc":"Example data, not a real project.","link":"https://example.com/repo-14","status":"Example"},
    {"title":"Example repo 15","desc":"Example data, not a real project.","link":"https://example.com/repo-15","status":"Example"}
  ],
  blog: []
};
