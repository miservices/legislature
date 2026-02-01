/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import About from './pages/About';
import BillDetail from './pages/BillDetail';
import Bills from './pages/Bills';
import ChapterDetail from './pages/ChapterDetail';
import Home from './pages/Home';
import House from './pages/House';
import ManageJournals from './pages/ManageJournals';
import ManageMSL from './pages/ManageMSL';
import ManageMembers from './pages/ManageMembers';
import ManageSessionCalendar from './pages/ManageSessionCalendar';
import ManageVotes from './pages/ManageVotes';
import MemberDashboard from './pages/MemberDashboard';
import Senate from './pages/Senate';
import StatutoryLaws from './pages/StatutoryLaws';
import SubmitBill from './pages/SubmitBill';
import TitleDetail from './pages/TitleDetail';
import VotesJournals from './pages/VotesJournals';
import Resolutions from './pages/Resolutions';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "BillDetail": BillDetail,
    "Bills": Bills,
    "ChapterDetail": ChapterDetail,
    "Home": Home,
    "House": House,
    "ManageJournals": ManageJournals,
    "ManageMSL": ManageMSL,
    "ManageMembers": ManageMembers,
    "ManageSessionCalendar": ManageSessionCalendar,
    "ManageVotes": ManageVotes,
    "MemberDashboard": MemberDashboard,
    "Senate": Senate,
    "StatutoryLaws": StatutoryLaws,
    "SubmitBill": SubmitBill,
    "TitleDetail": TitleDetail,
    "VotesJournals": VotesJournals,
    "Resolutions": Resolutions,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};