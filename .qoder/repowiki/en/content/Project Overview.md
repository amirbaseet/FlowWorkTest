# Project Overview

<cite>
**Referenced Files in This Document**   
- [App.tsx](file://App.tsx)
- [types.ts](file://types.ts)
- [constants.ts](file://constants.ts)
- [Dashboard.tsx](file://components/Dashboard.tsx)
- [Schedule.tsx](file://components/Schedule.tsx)
- [Substitutions.tsx](file://components/Substitutions.tsx)
- [AiAssistant.tsx](file://components/AiAssistant.tsx)
- [Reports.tsx](file://components/Reports.tsx)
- [ModeConfigModal.tsx](file://components/ModeConfigModal.tsx)
- [policyEngine.ts](file://utils/policyEngine.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Core Features](#core-features)
3. [Target Audience](#target-audience)
4. [Application Flow](#application-flow)
5. [User Workflows](#user-workflows)
6. [Architecture and Design](#architecture-and-design)

## Introduction

The application is an enterprise-level school scheduling and management system designed to streamline educational operations through AI-powered automation and intelligent decision-making. It serves as a comprehensive platform for managing teacher absences, class substitutions, operational mode configurations, and staff coordination. The system leverages advanced policy engines and real-time data processing to ensure continuity of education during disruptions while maintaining fairness and compliance with institutional policies.

Built on a modern React/Vite/TypeScript stack, the application provides a responsive and intuitive interface tailored for various user roles within an educational institution. Central to its functionality are key state objects such as `engineContext`, which manages active operational modes, `substitutionLogs` that track all substitution activities, and `scheduleConfig` that defines the structural parameters of the academic timetable. These components work in concert to enable dynamic adaptation to changing conditions such as weather, exams, trips, or emergencies.

The system's architecture emphasizes scalability, maintainability, and role-based access control, ensuring that administrators, teachers, operations staff, and analysts can interact with the platform according to their responsibilities and permissions.

**Section sources**
- [App.tsx](file://App.tsx#L1-L459)
- [types.ts](file://types.ts#L1-L382)
- [constants.ts](file://constants.ts#L1-L438)

## Core Features

The system offers a robust suite of features designed to enhance operational efficiency and educational continuity:

- **Intelligent Dashboard**: Provides a real-time chronometer view showing live school status, weather conditions, upcoming events, and staff availability. The dashboard serves as the central command center for monitoring daily operations and making informed decisions.

- **Smart Scheduling**: Enables users to view timetables from multiple perspectives—by class, teacher, or subject—with support for transposed layouts and filtering options. The schedule dynamically reflects active operational modes and event impacts.

- **AI-Powered Substitution System**: Automates the process of assigning substitutes during teacher absences by evaluating candidate availability, subject expertise, workload fairness, and institutional policies. The system supports both internal and external substitute pools.

- **Operational Mode Policies**: Implements configurable protocols for different scenarios such as rainy days, field trips, exam periods, and emergency situations. Each mode enforces specific rules (Golden Rules) and adjusts substitution priorities accordingly.

- **Reporting with Simulation**: Offers comprehensive reporting tools including compliance audits, payroll summaries, and detailed operational logs. The simulation engine allows administrators to model annual scenarios and assess system resilience under stress.

- **Excel Integration**: Facilitates seamless import and export of scheduling data through an Excel wizard, enabling integration with existing institutional systems and simplifying data migration.

These features are underpinned by a sophisticated policy engine that evaluates substitution candidates based on contextual factors such as subject domain compatibility, continuity of care, and temporary immunity from repeated assignments.

**Section sources**
- [Dashboard.tsx](file://components/Dashboard.tsx#L1-L417)
- [Schedule.tsx](file://components/Schedule.tsx#L1-L434)
- [Substitutions.tsx](file://components/Substitutions.tsx#L1-L531)
- [Reports.tsx](file://components/Reports.tsx#L1-L784)
- [utils/policyEngine.ts](file://utils/policyEngine.ts#L1-L406)

## Target Audience

The system is designed for four primary user groups, each with distinct needs and interaction patterns:

- **Administrators**: Responsible for configuring system-wide settings, managing staff roles, defining operational modes, and overseeing compliance. They utilize advanced features like the Mode Configuration Modal and simulation tools to optimize institutional policies.

- **Teachers**: Access their personal schedules, report absences, and view substitution assignments. The interface is optimized for quick navigation to relevant timetable views and absence reporting.

- **Operations Staff**: Manage day-to-day logistics including substitution coordination, event planning, and resource allocation. They interact extensively with the Substitutions module and real-time monitoring tools.

- **Analysts**: Focus on performance metrics, fairness assessments, and long-term planning. They leverage reporting dashboards, compliance tracking, and simulation results to evaluate system effectiveness and recommend improvements.

Role-based navigation is implemented through the `App.tsx` component, which directs users to appropriate views upon login based on their `baseRoleId`. For example, teachers are automatically directed to the schedule view, while principals gain access to administrative functions.

**Section sources**
- [App.tsx](file://App.tsx#L140-L170)
- [types.ts](file://types.ts#L10-L32)
- [constants.ts](file://constants.ts#L50-L55)

## Application Flow

The application follows a structured flow from authentication to feature utilization:

1. **Login Process**: Users authenticate using their national ID and password (matching the national ID for demo purposes). The `handleLogin` function in `App.tsx` validates credentials against stored employee data and sets the current user session.

2. **Role-Based Navigation**: Upon successful login, the system redirects users based on their role. Teachers are directed to the schedule view filtered to their classes, while other roles default to the dashboard.

3. **State Initialization**: The application initializes critical state objects from localStorage, including `employees`, `classes`, `lessons`, `scheduleConfig`, and `engineContext`. Default values are provided in `constants.ts` for clean-slate scenarios.

4. **Feature Interaction**: Users navigate between modules via the sidebar or mobile bottom navigation. Each view receives necessary data as props from the central `App` component.

5. **Operational Mode Activation**: Users can toggle predefined modes (e.g., rainyMode, tripMode) through buttons in the Schedule component, which updates the `engineContext` state and triggers corresponding policy enforcement.

6. **Data Persistence**: All modifications are automatically persisted to localStorage, ensuring data consistency across sessions without requiring explicit save actions.

This flow ensures a seamless transition from authentication to productive use, with contextual awareness maintained throughout the user journey.

**Section sources**
- [App.tsx](file://App.tsx#L140-L170)
- [constants.ts](file://constants.ts#L57-L61)
- [Schedule.tsx](file://components/Schedule.tsx#L277-L300)

## User Workflows

### Administrator Workflow
An administrator begins by logging in with super-admin credentials. They access the Settings module to configure school information and academic year parameters. When preparing for an upcoming exam period, they activate `examMode` through the Mode Configuration Modal, specifying the exam subject and adjusting priority rules to favor homeroom teachers and subject specialists. They then use the Reports module to simulate the impact of anticipated absences and ensure adequate substitute coverage.

### Teacher Workflow
A teacher logs in using their national ID as both username and password. They are automatically directed to their personal schedule view. When planning an absence, they navigate to the Substitutions module, select the date, and use the Absence Form to record their leave. The system suggests available substitutes based on current operational policies, which the teacher can review and confirm.

### Operations Staff Workflow
Operations staff monitor the Substitutions module daily, where they see a grid of absences and pending substitutions. They manage a global resource pool of available substitutes, both internal and external. When multiple absences occur, they use the system's AI recommendations to assign substitutes efficiently, ensuring minimal disruption to classroom instruction.

### Analyst Workflow
An analyst accesses the Reports module to generate an operational report for the past month. They filter the date range, review compliance metrics, and examine payroll data for external substitutes. To assess long-term resilience, they run the annual simulation, analyzing critical dates and receiving AI-generated recommendations for policy improvements.

These workflows demonstrate how the system supports diverse operational needs while maintaining a consistent, policy-driven approach to decision-making.

**Section sources**
- [App.tsx](file://App.tsx#L140-L170)
- [Substitutions.tsx](file://components/Substitutions.tsx#L50-L525)
- [Reports.tsx](file://components/Reports.tsx#L48-L143)
- [ModeConfigModal.tsx](file://components/ModeConfigModal.tsx#L62-L89)

## Architecture and Design

The application follows a component-based architecture built on React with TypeScript, leveraging Vite for fast development and bundling. Key design considerations include:

- **State Management**: Uses React's `useState` and `useLocalStorage` hooks for client-side state persistence. Critical application state—including `engineContext`, `substitutionLogs`, and `scheduleConfig`—is synchronized with localStorage to survive page reloads.

- **Type Safety**: Comprehensive type definitions in `types.ts` ensure compile-time validation of data structures, reducing runtime errors and improving code maintainability.

- **Scalability**: The modular component structure allows for easy extension of functionality. New operational modes can be added by defining corresponding configurations in `INITIAL_ENGINE_CONTEXT` without modifying core logic.

- **Design Trade-offs**: 
  - The reliance on localStorage limits data persistence to the client device but eliminates the need for a backend in the prototype phase.
  - Real-time weather integration enhances situational awareness but introduces external API dependencies.
  - The policy engine's complexity enables sophisticated decision-making but requires careful configuration to avoid conflicting rules.

- **Performance Optimization**: Implements memoization (`useMemo`, `React.memo`) in computationally intensive components like the Schedule and Dashboard to prevent unnecessary re-renders.

- **Accessibility**: Supports right-to-left (RTL) layout for Arabic language display while maintaining semantic HTML structure for screen readers.

This architecture balances immediate usability with long-term extensibility, providing a foundation that can evolve from a prototype to a production-ready system with minimal refactoring.

**Section sources**
- [App.tsx](file://App.tsx#L36-L46)
- [types.ts](file://types.ts#L1-L382)
- [hooks/useLocalStorage.ts](file://hooks/useLocalStorage.ts)
- [utils/policyEngine.ts](file://utils/policyEngine.ts#L75-L202)