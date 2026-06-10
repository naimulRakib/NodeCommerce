# UiPath Agent & AI Orchestration Test Plan

This document tracks the 15 end-to-end test cases for the NodeCommerce-UiPath Intelligent Logistics Orchestration system.

## Status Tracking
- `[ ]` **Test Case 1: Happy Path Full Approval**
- `[ ]` **Test Case 2: Target Rejects With Reason**
- `[ ]` **Test Case 3: Auto-Reject After Deadline With High Risk**
- `[ ]` **Test Case 4: Auto-Approve After Deadline With Low Risk**
- `[ ]` **Test Case 5: Risk Assessment Correctly Calculated**
- `[ ]` **Test Case 6: 3PL Booking Under Budget**
- `[ ]` **Test Case 7: 3PL Booking Over Budget**
- `[ ]` **Test Case 8: Broken Truck Self-Healing Full Flow**
- `[ ]` **Test Case 9: Duplicate Trigger Idempotency** (Handled natively by UiPath)
- `[ ]` **Test Case 10: Wrong Secret Rejected** (Implemented & verifiable)
- `[ ]` **Test Case 11: Document Generation Correctness**
- `[ ]` **Test Case 12: WhatsApp Fallback to SMS**
- `[ ]` **Test Case 13: LangSmith Trace Recorded (REZA Agent)**
- `[ ]` **Test Case 14: PROVA Seasonal Multiplier Applied Correctly**
- `[ ]` **Test Case 15: JUDGE Quantity Dispute Verdict**

## Execution Notes
Test Cases 1-10 are ready for immediate testing as the NodeCommerce APIs and Database Protections are fully deployed. 

Test Cases 13, 14, and 15 refer to the advanced **LangChain AI Agents (PROVA, JUDGE, REZA)**. We will need to build the LangSmith integrations and prompts for those specific agents before we can pass those test cases.
