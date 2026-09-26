/* Local preview only.
   Loaded by index.html when the host is localhost and the URL has ?mock=1.
   Production never requests this file, and Firebase Hosting ignores dev/.
   Text is taken from the 26 Sep 2026 site review. It is sample layout content,
   not a publishable blog and not a full copy of the live CV. */
window.MOCK_DATA = {
  label: "Local preview. The text on this page is sample content for layout review, not the live site.",
  cv: {
    tagline: "Economist · Researcher & Data Analyst",
    intro: "I'm an economist based in Helsinki. I work with time series, labour-market and remittance data, and I care about getting the method right and then explaining it plainly. I hold a Research Master's in Economics from the University of Helsinki, where my thesis tested whether Google Trends improves Bitcoin volatility forecasts.",
    summary: "I'm an economist and data analyst in Helsinki. I completed the Research Track of the Master's Programme in Economics at the University of Helsinki in May 2026. My thesis, supervised by Professor Mika Meitz, compared GARCH-family models with Random Forest regression for forecasting Bitcoin volatility, and tested whether Google Trends search interest adds predictive power. It largely doesn't: a Gaussian GARCH(1,1) was the benchmark that no competitor beat.\n\nMost of my recent work has been hands-on data work. At the University of Helsinki's Faculty of Theology (CHARM project) I cleaned and structured high-dimensional spectral data from medieval manuscript fragments and built reproducible R and Python pipelines for clustering and similarity analysis. Before moving to Finland I did empirical research support at the Strathmore Data Analytics Centre in Nairobi, and project and programme coordination at Strathmore University and the Strathmore Educational Trust.\n\nI work in R, Stata and Python, and I'm most interested in labour markets, remittances (especially Kenya's), and the Finnish economy. I'm improving my Finnish (currently A2). I'm open to roles in economic research, policy analysis and data analytics.",
    experience: [
      {
        role: "Research Assistant",
        company: "University of Helsinki — Faculty of Theology (CHARM project)",
        period: "Feb 2026 – Apr 2026",
        description: "Cleaned and structured spectral data from medieval manuscript fragments for clustering and similarity analysis, built reproducible R and Python pipelines, and supported metadata standardisation."
      },
      {
        role: "Research Trainee",
        company: "University of Helsinki — Faculty of Theology (CHARM project)",
        period: "Sep 2025 – Dec 2025",
        description: "Cleaned and structured spectral data from medieval manuscript fragments for clustering and similarity analysis, built reproducible R and Python pipelines, and supported metadata standardisation."
      }
    ],
    education: [
      {
        degree: "Master's Programme in Economics, Research Track",
        school: "University of Helsinki",
        period: "Completed May 2026"
      }
    ],
    skills: ["R", "Stata", "Python"],
    languages: [{ name: "Finnish", level: "A2" }],
    certifications: [],
    recommendations: [],
    research: [
      {
        title: "Does Google Trends Improve Bitcoin Volatility Forecasts?",
        year: "2026",
        type: "MSc thesis",
        institution: "University of Helsinki (Research Track)",
        supervisor: "Prof. Mika Meitz",
        summary: "Master's thesis, University of Helsinki (Research Track), supervised by Prof. Mika Meitz. Compares GARCH(1,1) and IGARCH(1,1) under normal and Student-t innovations, with and without lagged Google Trends attention, against Random Forest regression. Daily data from Jan 2017 to Sep 2025, QLIKE loss, SPA and MCS tests. Result: Gaussian GARCH(1,1) was not significantly outperformed, and sentiment added little. Fully reproducible in R + Python.",
        code: "https://github.com/eokinyo/Thesis_Work",
        pdf: "",
        status: "Completed 2026"
      },
      {
        title: "CHARM project — research data analysis",
        year: "2025–2026",
        type: "Research project",
        institution: "University of Helsinki",
        supervisor: "",
        summary: "Research Trainee (Sep–Dec 2025) and Research Assistant (Feb–Apr 2026). Cleaned and structured spectral data from medieval manuscript fragments for clustering and similarity analysis, built reproducible R and Python pipelines, and supported metadata standardisation.",
        code: "",
        pdf: "",
        status: "2025–2026"
      }
    ]
  },
  portfolio: [
    {
      title: "Football analytics pipeline (playerStats / sportsAnalytics)",
      desc: "Python pipelines ingesting FBref/Understat data for Europe's top five leagues, with xG analysis, backtesting, forecasting and automated visual reports.",
      link: "https://github.com/eokinyo/sportsAnalytics",
      status: "Python"
    },
    {
      title: "This site",
      desc: "Personal site built in vanilla JS on Firebase Hosting and Firestore, with an in-browser editor for CV, portfolio and a Markdown blog.",
      link: "https://github.com/eokinyo/EllyOkinyo",
      status: ""
    }
  ],
  blog: [
    {
      id: 1,
      slug: "kenya-remittances-shifting",
      title: "A record month, a shrinking year: Kenya's remittances are shifting away from North America",
      category: "economics",
      date: "2026-09-26",
      body: "August 2026 was the biggest month on record for money sent home to Kenya, yet the last 12 months are down 1.3%. Behind the headline, North America's share has fallen from 58% to 52% in a year, and Europe and the rest of the world are filling the gap.\n\n*Preview opening only. The full piece is not written yet.*"
    },
    {
      id: 2,
      slug: "a2-and-counting",
      title: "A2 and counting: what learning Finnish is teaching me about Finland's job market",
      category: "notes",
      date: "2026-09-20",
      body: "Finland's unemployment has been close to 10% (9.7% in 2025), and for people of foreign background it was 16.7% in 2024 against 6.6% for everyone else. I'm learning Finnish at A2 while looking for economics work. Here is what the language does and doesn't change.\n\n*Preview opening only. The full piece is not written yet.*"
    }
  ]
};
